// The renderer deliberately uses only this small, synchronous template API.
declare module 'nunjucks' {
  const nunjucks: {
    Environment: new (loader?: unknown, options?: { autoescape: boolean }) => {
      renderString(template: string, context: object): string;
    };
  };
  export default nunjucks;
}
