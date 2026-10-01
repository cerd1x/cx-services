import type { ValidationRule } from "graphql";
import { GraphQLError } from "graphql";
import { Kind, type ASTVisitor } from "graphql";

const MAX_DEPTH = 10;

export function depthLimitRule(maxDepth: number = MAX_DEPTH): ValidationRule {
  return (context) => {
    const fragmentDepths = new Map<string, number>();
    const visitedFragments = new Set<string>();

    const getFragmentDepth = (fragmentName: string, seen: Set<string>): number => {
      if (fragmentDepths.has(fragmentName)) return fragmentDepths.get(fragmentName) ?? 0;
      if (seen.has(fragmentName)) return 0;
      seen.add(fragmentName);
      const fragment = context.getFragment(fragmentName);
      if (!fragment) return 0;
      const depth = calculateDepth(fragment.selectionSet, seen);
      fragmentDepths.set(fragmentName, depth);
      return depth;
    };

    const calculateDepth = (
      selectionSet: { selections: ReadonlyArray<{ kind: string }> } | undefined,
      seen: Set<string>,
    ): number => {
      if (!selectionSet) return 0;
      let max = 0;
      for (const selection of selectionSet.selections) {
        if (selection.kind === Kind.FIELD || selection.kind === Kind.INLINE_FRAGMENT) {
          const field = selection as {
            selectionSet?: { selections: ReadonlyArray<{ kind: string }> };
            name?: { value: string };
          };
          const child =
            field.selectionSet != null ? calculateDepth(field.selectionSet, seen) + 1 : 1;
          if (child > max) max = child;
        } else if (selection.kind === Kind.FRAGMENT_SPREAD) {
          const spread = selection as { name?: { value: string } };
          const name = spread.name?.value ?? "";
          const child = getFragmentDepth(name, seen) + 1;
          if (child > max) max = child;
        }
      }
      return max;
    };

    const visitor: ASTVisitor = {
      OperationDefinition(node) {
        const depth = calculateDepth(node.selectionSet, new Set<string>());
        if (depth > maxDepth) {
          context.reportError(
            new GraphQLError(
              `Query is too deep (depth ${depth}). Maximum allowed depth is ${maxDepth}.`,
              { nodes: node },
            ),
          );
        }
        return false;
      },
      FragmentDefinition(node) {
        if (!visitedFragments.has(node.name.value)) {
          visitedFragments.add(node.name.value);
          fragmentDepths.set(node.name.value, calculateDepth(node.selectionSet, new Set<string>()));
        }
        return false;
      },
    };

    return visitor;
  };
}

const INTROSPECTION_FIELDS = new Set(["__schema", "__type", "__typename"]);

export function noIntrospectionInProductionRule(): ValidationRule {
  return (context) => ({
    Field(node) {
      const name = node.name.value;
      if (INTROSPECTION_FIELDS.has(name) && name !== "__typename") {
        context.reportError(
          new GraphQLError(`Introspection field "${name}" is not allowed in this environment.`, {
            nodes: node,
          }),
        );
      }
    },
  });
}

export { MAX_DEPTH };
