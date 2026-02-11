# MarketBrainOS Database Migration Guide

This guide walks you through migrating from Firebase/Firestore to Supabase PostgreSQL.

## Prerequisites

1. **Supabase Project**: Create a project at [supabase.com](https://supabase.com)
2. **Node.js & npm**: Install Node.js and npm for dependency management
3. **Existing MarketBrainOS**: Your current Firebase-based application

## Step 1: Database Setup

### 1.1 Run SQL Schema
1. Go to your Supabase dashboard
2. Navigate to **SQL Editor**
3. Copy and paste the contents of `supabase-schema.sql`
4. Execute the SQL to create all tables, functions, and policies

### 1.2 Configure Environment Variables
Update your `.env.local` file with the Supabase credentials:

```bash
# Supabase Configuration
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
VITE_SUPABASE_PUBLISHABLE_DEFAULT_KEY=your-publishable-key

# Keep existing Firebase config
VITE_FIREBASE_API_KEY=your_firebase_api_key
VITE_FIREBASE_AUTH_DOMAIN=your_firebase_auth_domain
# ... rest of Firebase config

# Keep existing Gemini config
VITE_GEMINI_API_KEY=your_gemini_api_key
```

## Step 2: Install Dependencies

```bash
npm install @supabase/supabase-js
```

## Step 3: Update Application Code

### 3.1 Replace Firestore Services
The following files have been updated to use Supabase:

- `src/services/supabase.ts` - New Supabase client
- `src/services/persistenceService.ts` - Updated to use Supabase instead of Firestore
- `src/services/firebase.ts` - Basic Firebase Auth service
- `src/context/AuthContext.tsx` - Auth context with Supabase integration

### 3.2 Key Changes Made

#### Database Operations
**Before (Firestore):**
```javascript
import { db } from './firebase'
const docRef = await db.collection('users').doc(userId).get()
```

**After (Supabase):**
```javascript
import { supabase } from './supabase'
const { data } = await supabase.from('users').select('*').eq('id', userId).single()
```

#### Complex Queries
**Before (Firestore limitations):**
```javascript
// Complex aggregations were difficult in Firestore
```

**After (Supabase SQL):**
```javascript
// Easy complex queries with SQL
const { data } = await supabase
  .from('angle_miner_results')
  .select(`
    *,
    user_profiles!inner (
      email,
      tokens
    )
  `)
  .eq('user_id', userId)
  .order('created_at', { ascending: false })
```

## Step 4: Test the Migration

### 4.1 Run Connection Test
Use the test file to verify your Supabase connection:

```javascript
import { testSupabaseConnection } from './src/test-supabase'
testSupabaseConnection()
```

### 4.2 Test User Operations
```javascript
import { testUserCreation, testProfileCreation } from './src/test-supabase'

// Test user creation
const user = await testUserCreation('test-user-id', 'test@example.com')

// Test profile creation
const profile = await testProfileCreation('test-user-id')
```

## Step 5: Update Existing Components

### 5.1 Update Dashboard
The Dashboard component now uses Supabase for:
- Token management
- Usage tracking
- Audit logs

### 5.2 Update Analysis Modules
All analysis modules (AngleMiner, TestLab, ConversionDoctor) now:
- Save results to PostgreSQL
- Use SQL for complex queries
- Benefit from better performance

## Step 6: Data Migration (Optional)

If you have existing Firebase data to migrate:

### 6.1 Export Firebase Data
```bash
# Use Firebase CLI to export data
firebase firestore:export ./firestore-export
```

### 6.2 Import to Supabase
Use the migration scripts in `scripts/migrate-data.js` to transform and import your data.

## Step 7: Update AI Processing

### 7.1 Job Queue System
The new job queue system uses PostgreSQL for:
- Reliable job tracking
- Better error handling
- Improved monitoring

### 7.2 Async Processing
```javascript
// New job processing with Supabase
export const executeAsyncJob = async (module, input) => {
  // Create job in PostgreSQL
  const { data: job } = await supabase
    .from('job_queue')
    .insert({
      module,
      input: JSON.stringify(input),
      status: 'pending'
    })
    .select()
    .single()

  // Poll for completion
  // ... polling logic
}
```

## Benefits of the Migration

### 1. **Better Performance**
- SQL queries are faster than Firestore for complex operations
- Proper indexing for optimal performance
- Better query optimization

### 2. **Enhanced Security**
- Row Level Security (RLS) for data isolation
- SQL injection protection
- Better audit trails

### 3. **Improved Developer Experience**
- Familiar SQL syntax
- Better tooling and debugging
- Easier complex queries

### 4. **Cost Efficiency**
- Lower costs at scale
- Predictable pricing model
- Better resource utilization

### 5. **Advanced Features**
- Complex aggregations and analytics
- Better relationships between data
- Advanced indexing options

## Troubleshooting

### Common Issues

#### 1. **Connection Errors**
- Verify Supabase URL and keys in `.env.local`
- Check network connectivity
- Ensure CORS is configured correctly

#### 2. **Permission Errors**
- Verify Row Level Security policies
- Check user authentication
- Ensure proper role assignments

#### 3. **Query Performance**
- Use the indexes created in the schema
- Monitor query performance in Supabase dashboard
- Consider query optimization

### Getting Help

1. **Supabase Documentation**: [supabase.com/docs](https://supabase.com/docs)
2. **MarketBrainOS Issues**: Check GitHub issues
3. **Community Support**: Supabase Discord

## Next Steps

1. **Test Thoroughly**: Run comprehensive tests with real data
2. **Monitor Performance**: Use Supabase dashboard to monitor queries
3. **Optimize**: Fine-tune queries and indexes based on usage patterns
4. **Scale**: Consider read replicas and caching for high traffic

## Rollback Plan

If you need to rollback to Firebase:

1. **Revert Code Changes**: Restore original Firestore services
2. **Update Environment**: Remove Supabase variables
3. **Database**: Keep Firebase data intact
4. **Test**: Verify all functionality works with Firebase

## Support

For migration support:
- Review the updated code files
- Test with sample data
- Monitor the Supabase dashboard for issues
- Use the test files to verify functionality

The migration maintains all existing functionality while providing significant improvements in performance, security, and developer experience.