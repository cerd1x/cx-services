/**
 * Ambient declaration untuk import SDL `*.gql?raw`.
 * Bundler (Bun/Vite) meng-stringify file `.gql`; TypeScript perlu tahu bentuknya.
 */
declare module "*.gql?raw" {
  const typeDefs: string;
  export default typeDefs;
}

declare module "*.gql" {
  const typeDefs: string;
  export default typeDefs;
}
