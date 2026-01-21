#!/usr/bin/env python3
"""
Analyze Odoo ticket message history to identify open tickets that need attention.
"""

import sys
import io
import os
# Fix Windows console encoding
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8', errors='replace')
sys.stderr = io.TextIOWrapper(sys.stderr.buffer, encoding='utf-8', errors='replace')

import json
from collections import defaultdict
from datetime import datetime, timedelta
import re
from html import unescape
import html2text

# Initialize html2text
h = html2text.HTML2Text()
h.ignore_links = True
h.ignore_images = True

def strip_html(html_content):
    """Convert HTML to plain text."""
    if not html_content:
        return ""
    try:
        return h.handle(html_content).strip()
    except:
        # Fallback: simple regex cleanup
        text = re.sub(r'<[^>]+>', ' ', html_content)
        return unescape(text).strip()

def load_data(filepath):
    """Load the JSON data file."""
    with open(filepath, 'r', encoding='utf-8') as f:
        data = json.load(f)
    # Extract the result array from the nested structure
    return data[0]['json']['result']

def analyze_tickets(messages):
    """
    Group messages by ticket (res_id) and analyze their status.
    """
    # Group messages by ticket
    tickets = defaultdict(list)
    for msg in messages:
        tickets[msg['res_id']].append(msg)

    # Sort messages within each ticket by date
    for ticket_id in tickets:
        tickets[ticket_id].sort(key=lambda x: x['date'])

    return tickets

def is_spam_or_marketing(body_text):
    """Detect spam/marketing emails."""
    spam_indicators = [
        'newsletter', 'abmelden', 'unsubscribe', 'online version',
        'webinar', 'marketing', 'angebot', 'rabatt', 'promotion',
        'fachkräftemarkt', 'lieferkette', 'esg-compliance', 'compliance',
        'reinigungsfirma', 'google-profil', 'strive', 'podcast',
        'pinterest', 'preisliste', 'runtastic', 'booste deine',
        'adobe acrobat sign', 'outstanding payment', 'unsigned',
        'asset management', 'stone ridge', 'investment'
    ]
    body_lower = body_text.lower()
    return any(indicator in body_lower for indicator in spam_indicators)

def is_order_confirmation(body_text):
    """Detect auto-generated order confirmation emails."""
    indicators = [
        'lieber genussentdecker',
        'ahoi und willkommen',
        'da sind wir wieder',
        'leinen los',
        'deine bestellung nr.',
        'deine gutscheine oder deine eintrittskarte',
        'flaschenpost findest',
        'vielen dank für deine bestellung'
    ]
    body_lower = body_text.lower()
    return any(indicator in body_lower for indicator in indicators)

def is_contact_form_submission(body_text):
    """Detect genuine contact form submissions."""
    # Must have Name: and Email: and Kommentar: fields
    has_name = 'name:' in body_text.lower()
    has_email = 'email:' in body_text.lower()
    has_comment = 'kommentar:' in body_text.lower() or 'telefon:' in body_text.lower()

    return has_name and has_email and has_comment

def is_partner_email(body_text):
    """Detect partner-related emails."""
    indicators = [
        'partner-portal',
        'diese nachricht wurde von seite',
        'servus, bitte einfach eingeben',
        'baristakurse',
        'latteart'
    ]
    body_lower = body_text.lower()
    return any(indicator in body_lower for indicator in indicators)

def extract_customer_info(body_text):
    """Extract customer name and email from contact form."""
    customer_name = ""
    customer_email = ""

    name_match = re.search(r'name:\s*([^\n<]+)', body_text, re.IGNORECASE)
    email_match = re.search(r'email:\s*([^\n<\s]+)', body_text, re.IGNORECASE)
    comment_match = re.search(r'kommentar:\s*(.+?)(?:\n\n|\Z)', body_text, re.IGNORECASE | re.DOTALL)

    if name_match:
        customer_name = name_match.group(1).strip()
    if email_match:
        customer_email = email_match.group(1).strip()

    comment = comment_match.group(1).strip() if comment_match else ""

    return customer_name, customer_email, comment

def classify_ticket(ticket_id, messages):
    """
    Classify a ticket as open or closed based on its message history.
    Returns: (status, reason, details, priority)
    Priority: 1=HIGH, 2=MEDIUM, 3=LOW
    """
    # Indicators
    has_insolvency_response = False
    has_customer_inquiry = False
    has_team_response = False
    is_auto_order = False
    is_spam = False
    is_partner = False
    last_customer_date = None
    last_team_date = None
    customer_followup_after_response = False

    first_message_body = ""
    customer_name = ""
    customer_email = ""
    customer_comment = ""

    for i, msg in enumerate(messages):
        body = msg.get('body', '') or ''
        body_text = strip_html(body)
        body_lower = body_text.lower()
        message_type = msg.get('message_type', '')
        author_id = msg.get('author_id', False)
        date_str = msg.get('date', '')

        # Parse date
        try:
            msg_date = datetime.strptime(date_str, '%Y-%m-%d %H:%M:%S')
        except:
            msg_date = None

        # Determine if this is from customer or team
        is_customer_message = (
            author_id is False or
            (isinstance(author_id, list) and 'bestellung@miomente.de' in str(author_id))
        )

        is_team_message = (
            isinstance(author_id, list) and
            author_id[0] not in [False, None] and
            'bestellung@miomente.de' not in str(author_id)
        )

        # Skip empty notifications
        if message_type == 'notification' and not body.strip():
            continue

        # Check categories
        if is_spam_or_marketing(body_text):
            is_spam = True

        if is_order_confirmation(body_text):
            is_auto_order = True

        if is_partner_email(body_text):
            is_partner = True

        # Check for insolvency response
        if 'miomente-inso.de' in body_lower or 'insolvenzverfahren' in body_lower:
            has_insolvency_response = True

        # Track customer inquiries
        if is_customer_message and message_type == 'email':
            if i == 0:
                first_message_body = body_text[:500]

            # Check if genuine contact form submission
            if is_contact_form_submission(body_text):
                has_customer_inquiry = True
                last_customer_date = msg_date
                if i == 0:
                    customer_name, customer_email, customer_comment = extract_customer_info(body_text)

                # Check if customer followed up after team response
                if has_team_response and msg_date:
                    customer_followup_after_response = True

        # Track team responses (excluding bot notifications)
        if is_team_message and message_type == 'comment':
            has_team_response = True
            last_team_date = msg_date

    # Determine status
    now = datetime(2026, 1, 21)  # Current date

    # CLOSED indicators - check these first
    if is_spam and not is_contact_form_submission(first_message_body):
        return ('CLOSED', 'SPAM', 'Marketing or spam email', 3)

    if is_auto_order and not has_customer_inquiry:
        return ('CLOSED', 'ORDER_CONFIRMATION', 'Auto-generated order confirmation', 3)

    if has_insolvency_response and not customer_followup_after_response:
        return ('CLOSED', 'INSOLVENCY_RESPONDED', 'Insolvency response sent, no follow-up', 3)

    if has_team_response and not customer_followup_after_response:
        if last_team_date and (now - last_team_date).days >= 3:
            return ('CLOSED', 'RESPONDED_NO_FOLLOWUP', 'Team responded, no customer follow-up for 3+ days', 3)

    # OPEN indicators
    if has_customer_inquiry and not has_team_response:
        days_old = (now - last_customer_date).days if last_customer_date else 999
        priority = 1 if days_old <= 1 else (2 if days_old <= 3 else 3)
        return ('OPEN', 'NO_RESPONSE', f'Customer inquiry with NO team response ({days_old} days old) | Name: {customer_name} | Email: {customer_email}', priority)

    if customer_followup_after_response:
        return ('OPEN', 'CUSTOMER_FOLLOWUP', f'Customer followed up after team response | Name: {customer_name} | Email: {customer_email}', 1)

    if is_partner:
        if not has_team_response:
            return ('OPEN', 'PARTNER_NO_RESPONSE', f'Partner inquiry with NO response', 1)
        else:
            return ('OPEN', 'PARTNER_RECENT', f'Partner communication', 2)

    if has_team_response and last_team_date:
        days_since = (now - last_team_date).days
        if days_since <= 3:
            return ('OPEN', 'RECENT_RESPONSE', f'Recent response ({days_since} days ago), may need follow-up', 3)

    # Default to closed if unclear
    return ('CLOSED', 'UNCLEAR', 'No clear customer inquiry detected', 3)

def main():
    print("Loading ticket data...")
    script_dir = os.path.dirname(os.path.abspath(__file__))
    filepath = os.path.join(script_dir, 'tickets_odoo.json')
    messages = load_data(filepath)
    print(f"Loaded {len(messages)} messages")

    print("\nAnalyzing tickets...")
    tickets = analyze_tickets(messages)
    print(f"Found {len(tickets)} unique tickets")

    # Classify all tickets
    open_tickets = defaultdict(list)
    closed_tickets = defaultdict(list)

    for ticket_id, msgs in tickets.items():
        status, reason, details, priority = classify_ticket(ticket_id, msgs)

        # Get first message info
        first_msg = msgs[0] if msgs else {}
        first_body = strip_html(first_msg.get('body', ''))

        ticket_info = {
            'ticket_id': ticket_id,
            'first_date': first_msg.get('date', ''),
            'last_date': msgs[-1].get('date', '') if msgs else '',
            'message_count': len(msgs),
            'reason': reason,
            'details': details,
            'priority': priority,
            'first_message_preview': first_body[:300]
        }

        if status == 'OPEN':
            open_tickets[reason].append(ticket_info)
        else:
            closed_tickets[reason].append(ticket_info)

    # Print results
    print("\n" + "="*80)
    print("OPEN TICKETS (Need Attention)")
    print("="*80)

    total_open = 0

    # Priority order for display
    priority_order = ['CUSTOMER_FOLLOWUP', 'PARTNER_NO_RESPONSE', 'NO_RESPONSE', 'PARTNER_RECENT', 'RECENT_RESPONSE']

    for reason in priority_order:
        if reason not in open_tickets:
            continue
        tickets_list = open_tickets[reason]
        print(f"\n{'='*60}")
        print(f"### {reason} ({len(tickets_list)} tickets) ###")
        print(f"{'='*60}")
        total_open += len(tickets_list)

        # Sort by priority then date
        tickets_list.sort(key=lambda x: (x['priority'], x['last_date']), reverse=False)

        # Group by priority
        high_priority = [t for t in tickets_list if t['priority'] == 1]
        medium_priority = [t for t in tickets_list if t['priority'] == 2]
        low_priority = [t for t in tickets_list if t['priority'] == 3]

        if high_priority:
            print(f"\n  [HIGH PRIORITY - {len(high_priority)} tickets]")
            for t in high_priority[:20]:
                print(f"\n    Ticket ID: {t['ticket_id']}")
                print(f"    Dates: {t['first_date']} - {t['last_date']}")
                print(f"    Messages: {t['message_count']}")
                print(f"    Details: {t['details']}")
                preview = t['first_message_preview'].replace('\n', ' ')[:150]
                print(f"    Preview: {preview}...")

        if medium_priority:
            print(f"\n  [MEDIUM PRIORITY - {len(medium_priority)} tickets]")
            for t in medium_priority[:10]:
                print(f"\n    Ticket ID: {t['ticket_id']}")
                print(f"    Dates: {t['first_date']} - {t['last_date']}")
                print(f"    Details: {t['details']}")

        if low_priority:
            print(f"\n  [LOW PRIORITY - {len(low_priority)} tickets]")
            print(f"    (Showing first 5 of {len(low_priority)})")
            for t in low_priority[:5]:
                print(f"    - Ticket {t['ticket_id']}: {t['details'][:80]}")

    print(f"\n\nTOTAL OPEN TICKETS: {total_open}")

    print("\n" + "="*80)
    print("CLOSED TICKETS SUMMARY")
    print("="*80)

    total_closed = 0
    for reason, tickets_list in sorted(closed_tickets.items()):
        print(f"  {reason}: {len(tickets_list)} tickets")
        total_closed += len(tickets_list)

    print(f"\nTOTAL CLOSED TICKETS: {total_closed}")

    # Save detailed results to JSON
    results = {
        'analysis_date': '2026-01-21',
        'summary': {
            'total_tickets': len(tickets),
            'total_open': total_open,
            'total_closed': total_closed,
            'open_by_reason': {r: len(t) for r, t in open_tickets.items()},
            'closed_by_reason': {r: len(t) for r, t in closed_tickets.items()}
        },
        'open_tickets': {
            reason: sorted(tickets_list, key=lambda x: (x['priority'], x['first_date']))
            for reason, tickets_list in open_tickets.items()
        },
        'closed_tickets': {r: len(t) for r, t in closed_tickets.items()}
    }

    results_path = os.path.join(script_dir, 'ticket_analysis_results.json')
    with open(results_path, 'w', encoding='utf-8') as f:
        json.dump(results, f, indent=2, ensure_ascii=False)

    print(f"\nDetailed results saved to {results_path}")

    # Create a simple actionable summary
    print("\n" + "="*80)
    print("ACTION ITEMS SUMMARY")
    print("="*80)

    print("\n1. HIGHEST PRIORITY - Customer Follow-ups:")
    for t in open_tickets.get('CUSTOMER_FOLLOWUP', []):
        print(f"   - Ticket {t['ticket_id']}: {t['details'][:60]}")

    print("\n2. HIGH PRIORITY - Unanswered Customer Inquiries (< 2 days old):")
    for t in open_tickets.get('NO_RESPONSE', [])[:15]:
        if t['priority'] == 1:
            print(f"   - Ticket {t['ticket_id']}: {t['details'][:60]}")

    print("\n3. PARTNER COMMUNICATIONS:")
    for t in open_tickets.get('PARTNER_NO_RESPONSE', [])[:5]:
        print(f"   - Ticket {t['ticket_id']}: {t['first_message_preview'][:80]}...")

if __name__ == '__main__':
    main()
