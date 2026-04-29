# Object Types

In JavaScript, the fundamental way that we group and pass around data is through
objects. In TypeScript, we represent those through object types.

Object types can be anonymous:

```typescript
function greet(person: { name: string; age: number }) {
  return "Hello " + person.name;
}
```

Or they can be named by using either an interface or a type alias:

```typescript
interface Person {
  name: string;
  age: number;
}
```
