# Functions in TypeScript

Functions are the primary means of passing data around in JavaScript.
TypeScript allows you to specify the types of both the input and output values
of functions.

## Parameter Type Annotations

When you declare a function, you can add type annotations after each parameter
to declare what types of parameters the function accepts:

```typescript
function greet(name: string) {
  console.log("Hello, " + name.toUpperCase() + "!!");
}
```

When a parameter has a type annotation, arguments to that function will be checked.
