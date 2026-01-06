import { NextRequest, NextResponse } from 'next/server';
import axios from 'axios';

const N8N_API_URL = process.env.NEXT_PUBLIC_N8N_API_URL;

export async function POST(request: NextRequest) {
  if (!N8N_API_URL) {
    console.error('NEXT_PUBLIC_N8N_API_URL is not set');
    return NextResponse.json({ error: 'Server configuration error' }, { status: 500 });
  }

  try {
    // 1. Get data from the incoming request
    const body = await request.json();
    const searchParams = request.nextUrl.searchParams;
    const action = searchParams.get('action');

    // 2. Prepare headers (forward Auth)
    const authHeader = request.headers.get('Authorization');
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    if (authHeader) {
      headers['Authorization'] = authHeader;
    }

    // 3. Forward request to n8n
    // Note: We don't need to catch errors explicitly here if we want axios to throw,
    // but handling them allows us to return the upstream error to the client.
    const response = await axios.post(N8N_API_URL, body, {
      params: { action }, // Forward the 'action' query param
      headers: headers,
    });

    // 4. Return n8n's response to the client
    return NextResponse.json(response.data);

  } catch (error: any) {
    console.error('Proxy Error calling n8n:', error.message);
    
    // Check if it's an axios error response from upstream
    if (error.response) {
      return NextResponse.json(error.response.data, { status: error.response.status });
    }

    // Otherwise, it's an internal error
    return NextResponse.json({ error: 'Internal Proxy Error' }, { status: 500 });
  }
}
