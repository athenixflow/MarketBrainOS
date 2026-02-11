/**
 * Firebase to Supabase Migration Script
 * 
 * This script helps migrate data from Firebase/Firestore to Supabase PostgreSQL
 * 
 * Usage: node scripts/migrate-firebase-to-supabase.js
 */

const { initializeApp, cert } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');
const { createClient } = require('@supabase/supabase-js');

// Firebase Admin SDK configuration
const firebaseConfig = {
  // You'll need to provide your Firebase service account key
  // This should be a JSON file with your Firebase service account credentials
  // Download from: Firebase Console > Project Settings > Service Accounts
};

// Supabase configuration
const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Supabase environment variables not set');
  console.log('Please ensure VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY are set in your .env.local file');
  process.exit(1);
}

// Initialize Firebase Admin
try {
  const app = initializeApp({
    credential: cert(firebaseConfig)
  });
  const db = getFirestore(app);
  console.log('✅ Firebase Admin initialized');
} catch (error) {
  console.error('❌ Failed to initialize Firebase Admin:', error.message);
  console.log('💡 To use this script, you need to:');
  console.log('   1. Create a Firebase service account key');
  console.log('   2. Add it to the firebaseConfig object above');
  console.log('   3. Install firebase-admin: npm install firebase-admin');
  process.exit(1);
}

// Initialize Supabase client
const supabase = createClient(supabaseUrl, supabaseKey);
console.log('✅ Supabase client initialized');

/**
 * Migration Functions
 */

async function migrateUsers() {
  console.log('\n🔄 Migrating users...');
  
  try {
    // Get all users from Firebase Auth
    const listUsersResult = await admin.auth().listUsers(1000);
    const users = listUsersResult.users;
    
    console.log(`Found ${users.length} users in Firebase`);
    
    // Prepare user data for Supabase
    const userData = users.map(user => ({
      id: user.uid,
      email: user.email,
      created_at: user.metadata.creationTime ? new Date(user.metadata.creationTime) : new Date(),
      last_active: user.metadata.lastSignInTime ? new Date(user.metadata.lastSignInTime) : null,
      risk_score: 0,
      is_suspended: false,
      suspension_reason: null,
      bot_confidence_score: 0
    }));
    
    // Insert users into Supabase
    const { data, error } = await supabase
      .from('users')
      .insert(userData)
      .select();
    
    if (error) {
      console.error('❌ Error inserting users:', error);
      return false;
    }
    
    console.log(`✅ Successfully migrated ${data.length} users`);
    return true;
    
  } catch (error) {
    console.error('❌ Error migrating users:', error);
    return false;
  }
}

async function migrateUserProfiles() {
  console.log('\n🔄 Migrating user profiles...');
  
  try {
    // Get all users from Supabase to create profiles for
    const { data: users, error: userError } = await supabase
      .from('users')
      .select('id');
    
    if (userError) {
      console.error('❌ Error fetching users:', userError);
      return false;
    }
    
    // Create default profiles for all users
    const profileData = users.map(user => ({
      id: user.id,
      tokens: 4, // Free tier default
      tier: 'free',
      role: 'user',
      permissions: [],
      session_started: null,
      is_verified_admin: false,
      last_verification: null
    }));
    
    const { data, error } = await supabase
      .from('user_profiles')
      .insert(profileData);
    
    if (error) {
      console.error('❌ Error inserting profiles:', error);
      return false;
    }
    
    console.log(`✅ Successfully created ${profileData.length} user profiles`);
    return true;
    
  } catch (error) {
    console.error('❌ Error migrating user profiles:', error);
    return false;
  }
}

async function migrateAnalysisResults() {
  console.log('\n🔄 Migrating analysis results...');
  
  const collections = [
    { name: 'angle_miner_results', table: 'angle_miner_results' },
    { name: 'test_lab_results', table: 'test_lab_results' },
    { name: 'conversion_doctor_results', table: 'conversion_doctor_results' }
  ];
  
  for (const collection of collections) {
    console.log(`\n  Migrating ${collection.name}...`);
    
    try {
      // Get all documents from Firestore collection
      const snapshot = await db.collection(collection.name).get();
      console.log(`    Found ${snapshot.size} documents`);
      
      if (snapshot.empty) {
        console.log(`    ✅ No data to migrate for ${collection.name}`);
        continue;
      }
      
      // Prepare data for Supabase
      const documents = [];
      snapshot.forEach(doc => {
        const data = doc.data();
        documents.push({
          id: doc.id,
          user_id: data.user_id,
          ...data,
          created_at: data.created_at?.toDate() || new Date()
        });
      });
      
      // Insert into Supabase
      const { data: inserted, error } = await supabase
        .from(collection.table)
        .insert(documents);
      
      if (error) {
        console.error(`    ❌ Error inserting ${collection.name}:`, error);
        continue;
      }
      
      console.log(`    ✅ Successfully migrated ${documents.length} ${collection.name}`);
      
    } catch (error) {
      console.error(`    ❌ Error migrating ${collection.name}:`, error);
    }
  }
}

async function migrateAuditLogs() {
  console.log('\n🔄 Migrating audit logs...');
  
  try {
    const snapshot = await db.collection('audit_logs').get();
    console.log(`Found ${snapshot.size} audit log entries`);
    
    if (snapshot.empty) {
      console.log('✅ No audit logs to migrate');
      return true;
    }
    
    const logs = [];
    snapshot.forEach(doc => {
      const data = doc.data();
      logs.push({
        id: doc.id,
        admin_email: data.admin_email,
        admin_role: data.admin_role,
        action_type: data.action_type,
        target: data.target,
        metadata: data.metadata,
        created_at: data.created_at?.toDate() || new Date()
      });
    });
    
    const { data: inserted, error } = await supabase
      .from('audit_logs')
      .insert(logs);
    
    if (error) {
      console.error('❌ Error inserting audit logs:', error);
      return false;
    }
    
    console.log(`✅ Successfully migrated ${logs.length} audit log entries`);
    return true;
    
  } catch (error) {
    console.error('❌ Error migrating audit logs:', error);
    return false;
  }
}

async function migrateSecurityEvents() {
  console.log('\n🔄 Migrating security events...');
  
  try {
    const snapshot = await db.collection('security_events').get();
    console.log(`Found ${snapshot.size} security events`);
    
    if (snapshot.empty) {
      console.log('✅ No security events to migrate');
      return true;
    }
    
    const events = [];
    snapshot.forEach(doc => {
      const data = doc.data();
      events.push({
        id: doc.id,
        user_id: data.user_id,
        event_type: data.event_type,
        severity: data.severity,
        details: data.details,
        risk_increment: data.risk_increment || 0,
        identity_fingerprint: data.identity_fingerprint,
        created_at: data.created_at?.toDate() || new Date()
      });
    });
    
    const { data: inserted, error } = await supabase
      .from('security_events')
      .insert(events);
    
    if (error) {
      console.error('❌ Error inserting security events:', error);
      return false;
    }
    
    console.log(`✅ Successfully migrated ${events.length} security events`);
    return true;
    
  } catch (error) {
    console.error('❌ Error migrating security events:', error);
    return false;
  }
}

async function runMigration() {
  console.log('🚀 Starting Firebase to Supabase Migration\n');
  
  const results = {
    users: false,
    profiles: false,
    analysis: false,
    audit: false,
    security: false
  };
  
  // Run migrations
  results.users = await migrateUsers();
  results.profiles = await migrateUserProfiles();
  results.analysis = await migrateAnalysisResults();
  results.audit = await migrateAuditLogs();
  results.security = await migrateSecurityEvents();
  
  // Summary
  console.log('\n📊 Migration Summary:');
  console.log(`   Users: ${results.users ? '✅' : '❌'}`);
  console.log(`   Profiles: ${results.profiles ? '✅' : '❌'}`);
  console.log(`   Analysis Results: ${results.analysis ? '✅' : '❌'}`);
  console.log(`   Audit Logs: ${results.audit ? '✅' : '❌'}`);
  console.log(`   Security Events: ${results.security ? '✅' : '❌'}`);
  
  const successCount = Object.values(results).filter(Boolean).length;
  const totalCount = Object.keys(results).length;
  
  if (successCount === totalCount) {
    console.log('\n🎉 Migration completed successfully!');
    console.log('\n💡 Next steps:');
    console.log('   1. Test your application with Supabase');
    console.log('   2. Verify data integrity');
    console.log('   3. Update any hardcoded Firebase references');
    console.log('   4. Consider backing up your Firebase data before decommissioning');
  } else {
    console.log(`\n⚠️  Migration completed with ${totalCount - successCount} failures`);
    console.log('   Please check the error messages above and retry failed migrations');
  }
}

// Run the migration
runMigration().catch(console.error);