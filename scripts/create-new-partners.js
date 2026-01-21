const crypto = require('crypto');
const fs = require('fs');

// Partners data from Magento query (excluding Julian Kutos)
const partners = [
  { partnername: "VENKO GmbH & Co. KG", customernumber: "127098", email: "kontakt@bar-foufou.de", city: "Stuttgart", country: "DE" },
  { partnername: "Martina Urban", customernumber: "100144", email: "tina@schlemmerschule.de", city: "Hamburg", country: "DE" },
  { partnername: "SOUTHkitchen GmbH", customernumber: "114839", email: "info@southkitchen.de", city: "Berlin", country: "DE" },
  { partnername: "GeoSign Cooking c/o Ercan Ahmet Erarslan Handelsvertretung", customernumber: "581280", email: "kochkurs@geo-sign.de", city: "Stuttgart", country: "DE" },
  { partnername: "Delicious Berlin, Geisler & Gollas GbR", customernumber: "107469", email: "info@delicious-berlin.com", city: "Berlin", country: "DE" },
  { partnername: "Herrmannsdorfer Landwerkstätten Glonn GmbH & Co. KG", customernumber: "128731", email: "elisabeth.morra-bruno@herrmannsdorfer.de", city: "Glonn", country: "DE" },
  { partnername: "Karen Heldmann - Kochschule Stuttgart", customernumber: "128910", email: "info@kochschule-stuttgart.de", city: "Stuttgart", country: "DE" },
  { partnername: "Roastillery GmbH", customernumber: "128894", email: "tasting@turmbar.de", city: "Hamburg", country: "DE" },
  { partnername: "cookingberlin", customernumber: "141249", email: "info@cookingberlin.de", city: "Berlin", country: "DE" },
  { partnername: "Chiaradia Lohbeck GbR, Anja Chiaradia & Thorsten Lohbeck", customernumber: "107560", email: "info@kochwerkstatt-ruhrgebiet.de", city: "Herten", country: "DE" },
  { partnername: "Frankfurter Personenschiffahrt Anton Nauheimer GmbH", customernumber: "127671", email: "m.guenther@primus-linie.de", city: "Frankfurt", country: "DE" },
  { partnername: "GENUSSWERKSTATT UG (haftungsbeschränkt)", customernumber: "101178", email: "zara.valenti@genusswerkstatt-muenchen.de", city: "München", country: "DE" },
  { partnername: "Matthias Kirschbaum, Kochschule Kirschbaum", customernumber: "130154", email: "m.c.kirschbaum@t-online.de", city: "Wuppertal", country: "DE" },
  { partnername: "Club Italia - Lukas Göldner & Marcel Sturm GbR.", customernumber: "523932", email: "ciao@club-italia.eu", city: "München", country: "DE" },
  { partnername: "Frankys Bar - Tammy-Laura Hohmann", customernumber: "518237", email: "frankysbar@web.de", city: "Köln", country: "DE" },
  { partnername: "ATLAS Restaurantbetriebe GmbH", customernumber: "115524", email: "atlas@atlas.at", city: "Hamburg", country: "AT" },
  { partnername: "Ginsburg Bar GmbH & Co KG", customernumber: "351850", email: "booking@schillingroofbar.com", city: "Heidelberg", country: "DE" },
  { partnername: "küchen WALTHER Bad Vilbel GmbH", customernumber: "117170", email: "kochkurs@kuechenwalther.de", city: "Bad Vilbel", country: "DE" },
  { partnername: "Barbaras Kochschule - Denise Rothacker", customernumber: "130654", email: "info@schwetzinger-kochschule.de", city: "Schwetzingen", country: "DE" },
];

// Generate random password (12 chars with letters, numbers, special chars)
function generatePassword() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789!@#$%&*';
  let password = '';
  for (let i = 0; i < 12; i++) {
    password += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return password;
}

// Hash password with SHA256
function hashPassword(password) {
  return crypto.createHash('sha256').update(password).digest('hex');
}

// Process partners
const processedPartners = partners.map(p => ({
  ...p,
  password: generatePassword(),
}));

// Add hashed passwords
processedPartners.forEach(p => {
  p.passwordHash = hashPassword(p.password);
});

// Generate CSV content
let csvContent = 'PartnerName,ContactName,Phone,Email,City,CountryCode,MagentoCustomerNumber,Login,Password\n';
processedPartners.forEach(p => {
  // Extract contact name from partner name if possible
  let contactName = p.partnername;
  csvContent += `"${p.partnername}","${contactName}","","${p.email}","${p.city}","${p.country}","${p.customernumber}","${p.email}","${p.password}"\n`;
});

// Write CSV file
fs.writeFileSync('scripts/new-partners-credentials.csv', csvContent);
console.log('CSV file created: scripts/new-partners-credentials.csv');

// Generate SQL for dev/prod PostgreSQL
let sqlInserts = `-- New Partners Insert Script for PostgreSQL
-- Generated: ${new Date().toISOString()}
-- Run this in prod_miomente_portal database

BEGIN;

`;

processedPartners.forEach(p => {
  const escapedName = p.partnername.replace(/'/g, "''");
  sqlInserts += `INSERT INTO miomente_partner_portal_users (email, name, password, customer_number, is_manager, created_at)
VALUES ('${p.email}', '${escapedName}', '${p.passwordHash}', '${p.customernumber}', false, NOW());

`;
});

sqlInserts += 'COMMIT;\n';

// Write SQL file
fs.writeFileSync('scripts/insert-new-partners-prod.sql', sqlInserts);
console.log('SQL file created: scripts/insert-new-partners-prod.sql');

// Output for console
console.log('\n--- Partner Credentials ---\n');
processedPartners.forEach(p => {
  console.log(`${p.partnername}`);
  console.log(`  Email: ${p.email}`);
  console.log(`  Password: ${p.password}`);
  console.log(`  Hash: ${p.passwordHash}`);
  console.log('');
});

// Export for use
module.exports = { processedPartners };
