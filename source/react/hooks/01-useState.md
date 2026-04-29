# useState Hook

useState is a React Hook that lets you add state to functional components.

## Basic Usage

```typescript
import { useState } from 'react';

function Counter() {
  const [count, setCount] = useState(0);

  return (
    <button onClick={() => setCount(count + 1)}>
      Count: {count}
    </button>
  );
}
```

The useState hook returns a tuple with the current state value and a setter
function to update it.
