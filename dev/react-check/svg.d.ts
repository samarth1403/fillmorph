/** `.svg` files load as their markup text (esbuild's `text` loader, see dev/tsup.config.ts). */
declare module "*.svg" {
  const markup: string;
  export default markup;
}
