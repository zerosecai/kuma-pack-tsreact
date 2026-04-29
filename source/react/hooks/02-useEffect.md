# useEffect Hook

useEffect is a React Hook that lets you synchronize a component with an
external system, such as a network request, browser API, or third-party
library.

## Basic Usage

```typescript
import { useEffect, useState } from 'react';

function UserProfile({ userId }: { userId: string }) {
  const [user, setUser] = useState(null);

  useEffect(() => {
    fetchUser(userId).then(setUser);
  }, [userId]);

  return user ? <div>{user.name}</div> : <div>Loading...</div>;
}
```

The dependency array controls when the effect re-runs.
