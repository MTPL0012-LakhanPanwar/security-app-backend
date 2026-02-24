require('dotenv').config();
const mongoose = require('mongoose');
const Facility = require('../models/Facility.model');
const QRCode = require('../models/QRCode.model');
const qrGenerator = require('../utils/qrGenerator');

const generateQRCodes = async (facilityId) => {
  try {
    // Connect to database
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Connected to MongoDB');

    // Find facility by Mongo _id or by facilityId string
    let facility = null;
    if (mongoose.Types.ObjectId.isValid(facilityId)) {
      facility = await Facility.findById(facilityId);
    }
    if (!facility) {
      facility = await Facility.findOne({ facilityId });
    }
    
    if (!facility) {
      console.error('Facility not found');
      process.exit(1);
    }

    console.log(`\nGenerating QR codes for: ${facility.name}`);
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

    // Set validity period (30 days)
    const validUntil = new Date();
    validUntil.setDate(validUntil.getDate() + 30);

    // Generate Entry QR
    console.log('Generating ENTRY QR Code...');
    const entryQR = await qrGenerator.generateCompleteQRCode(
      'lock',
      facilityId,
      { location: 'Main Entrance', type: 'entry' }
    );

    const entryQRCode = await QRCode.create({
      qrCodeId: entryQR.qrCodeId,
      facilityId: facility._id,
      type: 'entry',
      action: 'lock',
      token: entryQR.token,
      url: entryQR.url,
      imagePath: entryQR.imagePath,
      metadata: { location: 'Main Entrance', type: 'entry' },
      validUntil
    });

    console.log('Entry QR Code generated');
    console.log(`ID: ${entryQRCode.qrCodeId}`);
    console.log(`Image: ${entryQRCode.imagePath}`);
    console.log(`Valid until: ${validUntil.toISOString()}\n`);

    // Generate Exit QR
    console.log('Generating EXIT QR Code...');
    const exitQR = await qrGenerator.generateCompleteQRCode(
      'unlock',
      facilityId,
      { location: 'Main Exit', type: 'exit' }
    );

    const exitQRCode = await QRCode.create({
      qrCodeId: exitQR.qrCodeId,
      facilityId: facility._id,
      type: 'exit',
      action: 'unlock',
      token: exitQR.token,
      url: exitQR.url,
      imagePath: exitQR.imagePath,
      metadata: { location: 'Main Exit', type: 'exit' },
      validUntil
    });

    console.log('Exit QR Code generated');
    console.log(`ID: ${exitQRCode.qrCodeId}`);
    console.log(`Image: ${exitQRCode.imagePath}`);
    console.log(`Valid until: ${validUntil.toISOString()}\n`);

    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('QR Codes generated successfully!');
    console.log(`Check: ./uploads/qr-codes/\n`);

    process.exit(0);
  } catch (error) {
    console.error('Error generating QR codes:', error);
    process.exit(1);
  }
};

// Get facility ID from command line
const facilityId = process.argv[2];

if (!facilityId) {
  console.error('Please provide a facility ID');
  console.log('Usage: node scripts/generateQR.js <facilityId>');
  process.exit(1);
}

generateQRCodes(facilityId);
