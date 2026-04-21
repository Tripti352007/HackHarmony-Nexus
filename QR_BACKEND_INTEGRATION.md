# 🔧 Developer Integration Guide - QR System

## Overview
This guide helps developers integrate the client-side QR verification system with backend services like Supabase, Firebase, or custom APIs.

## Backend Integration Points

### 1. QR Token Storage

**When to call:**
After `generateQRData()` is called in `displayQRCode()`

**Data to save:**
```javascript
{
  id: UUID(),
  request_id: req.id,
  token: qrData.token,
  volunteer_id: user.id,
  helper_id: req.id,  // The person requesting help
  issued_at: new Date(),
  expires_at: new Date(Date.now() + 2 * 60 * 60 * 1000),
  status: 'pending', // pending, verified, expired, revoked
  qr_data_hash: hash(qrData), // For validation
  created_at: new Date()
}
```

**Supabase Example:**
```javascript
async function saveQRTokenToSupabase(qrData) {
  try {
    const { data, error } = await supabase
      .from('qr_tokens')
      .insert([{
        request_id: qrData.reqId,
        token: qrData.token,
        volunteer_id: qrData.helperId,
        issued_at: qrData.timestamp,
        expires_at: new Date(new Date(qrData.timestamp).getTime() + qrData.expiresIn),
        status: 'pending',
        qr_data: qrData // Store full data for later validation
      }]);
    
    if (error) throw error;
    console.log('QR token saved:', data);
    return data[0];
  } catch (error) {
    console.error('Error saving QR token:', error);
  }
}
```

### 2. QR Token Validation

**When to call:**
In `verifyQRToken()` before marking request as done

**Backend validation logic:**
```javascript
async function validateQRTokenOnServer(tokenData, requestId) {
  try {
    // Call your backend API
    const response = await fetch('/api/qr/validate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        token: tokenData.token,
        request_id: requestId,
        timestamp: new Date().toISOString()
      })
    });
    
    const result = await response.json();
    
    if (!response.ok) {
      throw new Error(result.message || 'Validation failed');
    }
    
    return result; // { valid: true, message: '...' }
  } catch (error) {
    console.error('Validation error:', error);
    return { valid: false, message: error.message };
  }
}
```

**Server-side validation (Node.js/Express):**
```javascript
app.post('/api/qr/validate', async (req, res) => {
  try {
    const { token, request_id } = req.body;
    
    // 1. Parse token
    let qrData;
    try {
      qrData = JSON.parse(token);
    } catch (e) {
      return res.status(400).json({ 
        valid: false, 
        message: 'Invalid token format' 
      });
    }
    
    // 2. Lookup token in database
    const qrRecord = await supabase
      .from('qr_tokens')
      .select('*')
      .eq('token', qrData.token)
      .eq('request_id', request_id)
      .single();
    
    if (!qrRecord.data) {
      return res.status(401).json({ 
        valid: false, 
        message: 'Token not found' 
      });
    }
    
    // 3. Check expiration
    if (new Date() > new Date(qrRecord.data.expires_at)) {
      return res.status(401).json({ 
        valid: false, 
        message: 'Token expired' 
      });
    }
    
    // 4. Check status
    if (qrRecord.data.status !== 'pending') {
      return res.status(401).json({ 
        valid: false, 
        message: 'Token already used' 
      });
    }
    
    // 5. Verify request exists and is matched
    const request = await supabase
      .from('requests')
      .select('*')
      .eq('id', request_id)
      .eq('status', 'matched')
      .single();
    
    if (!request.data) {
      return res.status(401).json({ 
        valid: false, 
        message: 'Request not found or not matched' 
      });
    }
    
    // 6. Update token status
    await supabase
      .from('qr_tokens')
      .update({ status: 'verified', verified_at: new Date() })
      .eq('token', qrData.token);
    
    // 7. Mark request as done
    await supabase
      .from('requests')
      .update({ 
        status: 'done',
        verified_at: new Date(),
        verified_by: qrData.helperId // volunteer who helped
      })
      .eq('id', request_id);
    
    // 8. Award points
    await supabase
      .from('volunteers')
      .update({ 
        points: supabase.raw('points + 20'),
        helped_count: supabase.raw('helped_count + 1')
      })
      .eq('id', qrRecord.data.volunteer_id);
    
    res.json({ 
      valid: true, 
      message: 'QR verified successfully',
      verified_at: new Date()
    });
    
  } catch (error) {
    console.error('Validation error:', error);
    res.status(500).json({ 
      valid: false, 
      message: 'Server error' 
    });
  }
});
```

### 3. Verification Logging

**What to log:**
```javascript
{
  id: UUID(),
  qr_token_id: tokenId,
  request_id: requestId,
  volunteer_id: volunteerId,
  helper_id: helperId,
  verified_at: new Date(),
  verification_method: 'camera', // or 'manual_paste'
  ip_address: clientIP,
  user_agent: navigator.userAgent,
  status: 'success' // or 'failed'
}
```

**Supabase logging:**
```javascript
async function logVerification(verification) {
  try {
    const { data, error } = await supabase
      .from('verification_logs')
      .insert([verification]);
    
    if (error) throw error;
    return data[0];
  } catch (error) {
    console.error('Error logging verification:', error);
  }
}
```

### 4. Points & Achievement System

**Update volunteer stats after verification:**
```javascript
async function updateVolunteerStats(volunteerId) {
  try {
    // Get current stats
    const { data: volunteer } = await supabase
      .from('volunteers')
      .select('points, helped_count, verified_completions')
      .eq('id', volunteerId)
      .single();
    
    // Award points if verified
    const newPoints = volunteer.points + 20;
    const newHelped = volunteer.helped_count + 1;
    
    // Check for badges
    let newBadge = null;
    if (newHelped === 10) newBadge = 'first_10_helper';
    if (newHelped === 50) newBadge = 'community_star';
    if (newHelped === 100) newBadge = 'local_hero';
    
    // Update database
    await supabase
      .from('volunteers')
      .update({
        points: newPoints,
        helped_count: newHelped,
        verified_completions: volunteer.verified_completions + 1,
        last_helped_at: new Date()
      })
      .eq('id', volunteerId);
    
    // Award badge if earned
    if (newBadge) {
      await awardBadge(volunteerId, newBadge);
    }
    
    return { newPoints, newHelped, newBadge };
  } catch (error) {
    console.error('Error updating stats:', error);
  }
}
```

### 5. Fraud Detection

**Patterns to watch:**
```javascript
async function checkFraudPatterns(volunteerId) {
  // Query recent verifications
  const { data: recentVerifications } = await supabase
    .from('verification_logs')
    .select('*')
    .eq('volunteer_id', volunteerId)
    .gt('verified_at', new Date(Date.now() - 24 * 60 * 60 * 1000)) // Last 24h
    .order('verified_at', { ascending: false });
  
  const patterns = {
    // Too many verifications in short time
    spamming: recentVerifications.length > 20,
    
    // Same location multiple times
    location_abuse: checkLocationRepeat(recentVerifications),
    
    // Rapid request switching
    rapid_switching: checkRapidSwitching(recentVerifications),
    
    // Same person helping multiple times quickly
    same_requestor: checkSameRequestor(recentVerifications)
  };
  
  // Flag suspicious accounts
  if (Object.values(patterns).some(p => p)) {
    await flagAccount(volunteerId, patterns);
  }
  
  return patterns;
}
```

### 6. Analytics & Reporting

**Key metrics to track:**
```javascript
async function getQRAnalytics(startDate, endDate) {
  // Total QR codes generated
  const totalGenerated = await supabase
    .from('qr_tokens')
    .select('id', { count: 'exact' })
    .gte('issued_at', startDate)
    .lte('issued_at', endDate);
  
  // Successful verifications
  const verified = await supabase
    .from('qr_tokens')
    .select('id', { count: 'exact' })
    .eq('status', 'verified')
    .gte('issued_at', startDate)
    .lte('issued_at', endDate);
  
  // Expired/unused
  const expired = await supabase
    .from('qr_tokens')
    .select('id', { count: 'exact' })
    .eq('status', 'expired')
    .gte('issued_at', startDate)
    .lte('issued_at', endDate);
  
  // Verification time average
  const { data: timings } = await supabase
    .from('verification_logs')
    .select('verified_at, created_at')
    .gte('verified_at', startDate)
    .lte('verified_at', endDate);
  
  const avgVerificationTime = calculateAverage(timings);
  
  return {
    total_generated: totalGenerated.count,
    successfully_verified: verified.count,
    expired_unused: expired.count,
    verification_rate: (verified.count / totalGenerated.count * 100).toFixed(2) + '%',
    avg_verification_time_ms: avgVerificationTime,
    timestamp: new Date()
  };
}
```

## Integration Checklist

- [ ] Create `qr_tokens` table in database
- [ ] Create `verification_logs` table
- [ ] Create `/api/qr/validate` endpoint
- [ ] Add fraud detection logic
- [ ] Add analytics queries
- [ ] Update volunteer stats table
- [ ] Add badge system
- [ ] Create admin dashboard for monitoring
- [ ] Set up alerts for suspicious patterns
- [ ] Add test cases for backend validation

## Client-Side Integration

### Modify `verifyQRToken()` to use backend:

```javascript
async function verifyQRToken(tokenData, reqId) {
  try {
    const qrData = JSON.parse(tokenData);
    
    // Call backend validation instead of client-only check
    const validation = await validateQRTokenOnServer(qrData, reqId);
    
    if (!validation.valid) {
      showScannerResult('❌ ' + validation.message, '', false);
      return;
    }
    
    // Update local state
    const acceptedReq = reqs.find(r => r.id === qrData.reqId);
    acceptedReq.status = 'done';
    acceptedReq.verifiedAt = new Date().toISOString();
    
    showScannerResult('✅ Verified!', 'Request completed successfully!', true);
    
    setTimeout(() => {
      closeQRScanner();
      renderMyReqs();
      renderVDash();
      toast('Request completed!', 'अनुरोध पूरा!');
    }, 2000);
    
  } catch (error) {
    showScannerResult('❌ Error', error.message, false);
  }
}
```

## Database Schema

### qr_tokens table
```sql
CREATE TABLE qr_tokens (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  request_id TEXT NOT NULL REFERENCES requests(id),
  token TEXT NOT NULL UNIQUE,
  volunteer_id TEXT NOT NULL REFERENCES volunteers(id),
  issued_at TIMESTAMP DEFAULT now(),
  expires_at TIMESTAMP NOT NULL,
  verified_at TIMESTAMP,
  status TEXT DEFAULT 'pending', -- pending, verified, expired, revoked
  qr_data JSONB,
  created_at TIMESTAMP DEFAULT now(),
  updated_at TIMESTAMP DEFAULT now()
);

CREATE INDEX idx_qr_tokens_token ON qr_tokens(token);
CREATE INDEX idx_qr_tokens_request_id ON qr_tokens(request_id);
CREATE INDEX idx_qr_tokens_volunteer_id ON qr_tokens(volunteer_id);
CREATE INDEX idx_qr_tokens_status ON qr_tokens(status);
```

### verification_logs table
```sql
CREATE TABLE verification_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  qr_token_id UUID REFERENCES qr_tokens(id),
  request_id TEXT NOT NULL,
  volunteer_id TEXT NOT NULL,
  helper_id TEXT NOT NULL,
  verified_at TIMESTAMP DEFAULT now(),
  verification_method TEXT, -- 'camera', 'manual_paste'
  ip_address INET,
  user_agent TEXT,
  status TEXT DEFAULT 'success',
  error_message TEXT,
  created_at TIMESTAMP DEFAULT now()
);

CREATE INDEX idx_verification_logs_volunteer ON verification_logs(volunteer_id);
CREATE INDEX idx_verification_logs_request ON verification_logs(request_id);
```

## API Endpoints

### POST /api/qr/generate
Generate new QR token (already handled client-side, but could move to server)

```javascript
POST /api/qr/generate
{
  request_id: "R01",
  volunteer_id: "vol-123"
}

Response:
{
  token: "...",
  qr_data: {...},
  expires_at: "2026-04-21T12:30:00Z"
}
```

### POST /api/qr/validate
Validate scanned QR code

```javascript
POST /api/qr/validate
{
  token: "{...json...}",
  request_id: "R01"
}

Response:
{
  valid: true/false,
  message: "...",
  verified_at: "2026-04-21T10:45:00Z"
}
```

### GET /api/qr/analytics
Get QR system metrics

```javascript
GET /api/qr/analytics?from=2026-04-01&to=2026-04-30

Response:
{
  total_generated: 1250,
  successfully_verified: 1210,
  verification_rate: "96.8%",
  avg_verification_time_ms: 45000
}
```

## Error Handling

```javascript
const QR_ERRORS = {
  INVALID_TOKEN: 'Token format invalid',
  EXPIRED: 'QR Code has expired',
  NOT_FOUND: 'Token not found',
  ALREADY_USED: 'QR Code already used',
  REQUEST_MISMATCH: 'Token doesn\'t match request',
  REQUEST_NOT_FOUND: 'Request not found',
  WRONG_STATUS: 'Request not in matched status',
  NETWORK_ERROR: 'Network error - check connection'
};
```

## Security Best Practices

1. **Always validate on server** - Never trust client-side validation alone
2. **Use HTTPS** - Encrypt token transmission
3. **Rate limiting** - Limit verification attempts (5/min per IP)
4. **Token rotation** - Consider regenerating tokens if leaked
5. **Audit logging** - Log all verification attempts
6. **CORS** - Restrict QR API to your domain
7. **Authentication** - Verify user identity before validation
8. **Geolocation** - Optional: Verify location matches request

## Testing

### Unit Tests
```javascript
describe('QR Validation', () => {
  it('should reject expired tokens', async () => {
    // Create token from 2+ hours ago
    // Attempt to validate
    // Expect rejection
  });
  
  it('should reject mismatched tokens', async () => {
    // Create token for Request A
    // Try to use for Request B
    // Expect rejection
  });
  
  it('should reject already-verified tokens', async () => {
    // Mark token as verified
    // Try to verify again
    // Expect rejection
  });
});
```

## Deployment Considerations

1. **Database backups** - Regular backups of QR tokens
2. **Performance** - Index on `token` and `status` fields
3. **Monitoring** - Alert on suspicious patterns
4. **Caching** - Cache verification results briefly
5. **Scaling** - Prepare for high volume

---

**Version**: 1.0  
**Last Updated**: April 2026
