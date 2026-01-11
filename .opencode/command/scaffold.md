---
description: Scaffold a new component, route, or service
agent: developer
---

# Scaffold: $1 $2

Create a new $1 named $2 following Omega project conventions.

## Component Types

### React Component

Location: `frontend/src/components/$2.jsx`

```jsx
import React from 'react';

const $2 = ({ className, ...props }) => {
  return (
    <div className={className} {...props}>
      {/* Component content */}
    </div>
  );
};

export default $2;
```

### API Route

Location: `server/routes/$2.js`

```javascript
const express = require('express');
const router = express.Router();
const logger = require('../utils/logger');

// GET /api/$2
router.get('/', async (req, res, next) => {
  try {
    // Implementation
    res.json({ success: true });
  } catch (error) {
    logger.error('$2 error:', error);
    next(error);
  }
});

module.exports = router;
```

### Service

Location: `server/services/$2Service.js`

```javascript
const logger = require('../utils/logger');

class $2Service {
  constructor() {
    // Initialize
  }

  async process(data) {
    try {
      // Implementation
      return { success: true };
    } catch (error) {
      logger.error('$2Service error:', error);
      throw error;
    }
  }
}

module.exports = new $2Service();
```

## Usage Examples

```
/scaffold component UserAvatar
/scaffold route analytics
/scaffold service notification
```

## Post-Scaffold Checklist

- [ ] Add to appropriate index/barrel file
- [ ] Register route in server.js (for routes)
- [ ] Add tests
- [ ] Update documentation if needed
