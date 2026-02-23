require('dotenv').config();
const mongoose = require('mongoose');
const Facility = require('../models/Facility.model');
const QRCode = require('../models/QRCode.model');
const qrGenerator = require('../utils/qrGenerator');

const setup = async () => {
  try {
    // Connect to database
    if (!process.env.MONGODB_URI) {
        console.error('❌ MONGODB_URI is not defined in .env');
        process.exit(1);
    }

    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Connected to MongoDB');

    // Create a facility
    const facilityName = "Secure Facility A";
    
    // Check if facility exists
    let facility = await Facility.findOne({ name: facilityName });
    
    if (!facility) {
      facility = await Facility.create({
        facilityId: "FAC-001",
        name: facilityName,
        location: {
          address: "123 Security Blvd"
        },
        status: 'active',
        settings: {
          maxEnrollmentDuration: 24
        }
      });
      console.log(`✅ Created Facility: ${facility.name} (${facility._id})`);
    } else {
        console.log(`ℹ️ Facility already exists: ${facility.name} (${facility._id})`);
    }

    // Generate Entry QR
    console.log('\n🔐 Generating ENTRY QR Code...');
    const entryQR = await qrGenerator.generateCompleteQRCode(
      'lock',
      facility._id,
      { location: 'Main Entrance', type: 'entry' }
    );

    // Save Entry QR to DB
    const entryQRCode = await QRCode.create({
      qrCodeId: entryQR.qrCodeId,
      facilityId: facility._id,
      type: 'entry',
      action: 'lock',
      token: entryQR.token,
      url: entryQR.url,
      imagePath: entryQR.imagePath,
      metadata: { location: 'Main Entrance', type: 'entry' },
      validUntil: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) // 30 days
    });

    console.log('✅ Entry QR Code generated');
    console.log(`   Token (Use this in scan-entry): ${entryQR.token}`);
    
    // Generate Exit QR
    console.log('\n🔓 Generating EXIT QR Code...');
    const exitQR = await qrGenerator.generateCompleteQRCode(
      'unlock',
      facility._id,
      { location: 'Main Exit', type: 'exit' }
    );

    // Save Exit QR to DB
    const exitQRCode = await QRCode.create({
      qrCodeId: exitQR.qrCodeId,
      facilityId: facility._id,
      type: 'exit',
      action: 'unlock',
      token: exitQR.token,
      url: exitQR.url,
      imagePath: exitQR.imagePath,
      metadata: { location: 'Main Exit', type: 'exit' },
      validUntil: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
    });

    console.log('✅ Exit QR Code generated');
    console.log(`   Token (Use this in scan-exit): ${exitQR.token}`);

    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('🎉 Setup Complete! Use the tokens above for testing.');
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Error setting up:', error);
    process.exit(1);
  }
};

setup();
