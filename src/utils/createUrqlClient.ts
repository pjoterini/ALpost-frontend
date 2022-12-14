import {
  Cache,
  cacheExchange,
  Entity,
  Resolver,
} from "@urql/exchange-graphcache";
import { dedupExchange, fetchExchange } from "urql";
import {
  DeletePostMutationVariables,
  DeleteReplyMutationVariables,
  LoginMutation,
  LogoutMutation,
  MeDocument,
  MeQuery,
  RegisterMutation,
  VoteMutationVariables,
  VoteReplyMutationVariables,
} from "../generated/graphql";
import { betterUpdateQuery } from "./betterUpdateQuery";
import { stringifyVariables, gql } from "@urql/core";
import { isServer } from "./isServer";

export type MergeMode = "before" | "after";

export interface PaginationParams {
  offsetArgument?: string;
  limitArgument?: string;
  mergeMode?: MergeMode;
}

export const cursorPagination = (): Resolver => {
  return (_parent, fieldArgs, cache, info) => {
    const { parentKey: entityKey, fieldName } = info;

    const allFields = cache.inspectFields(entityKey);

    const fieldInfos = allFields.filter((info) => info.fieldName === fieldName);
    const size = fieldInfos.length;
    if (size === 0) {
      return undefined;
    }

    const fieldKey = `${fieldName}(${stringifyVariables(fieldArgs)})`;
    const isItInCache = cache.resolve(
      cache.resolve(entityKey, fieldKey) as string,
      "posts"
    );
    info.partial = !isItInCache;
    let hasMore = true;
    const results: string[] = [];
    fieldInfos.forEach((fi) => {
      const key = cache.resolve(entityKey, fi.fieldKey) as Entity;
      const data = cache.resolve(key, "posts") as string[];
      const _hasMore = cache.resolve(key, "hasMore");
      if (!_hasMore) {
        hasMore = _hasMore as boolean;
      }
      results.push(...data);
    });

    return {
      __typename: "PaginatedPosts",
      hasMore,
      posts: results,
    };
  };
};

function invalidateAllPosts(cache: Cache) {
  const allFields = cache.inspectFields("Query");
  const fieldInfos = allFields.filter((info) => info.fieldName === "posts");
  fieldInfos.forEach((fi) => {
    cache.invalidate("Query", "posts", fi.arguments || {});
  });
}

function invalidateAllReplies(cache: Cache) {
  const allFields = cache.inspectFields("Query");
  const fieldInfos = allFields.filter((info) => info.fieldName === "replies");
  fieldInfos.forEach((fi) => {
    cache.invalidate("Query", "replies", fi.arguments || {});
  });
}

export const createUrqlClient = (ssrExchange: any, ctx: any) => {
  let cookie = "";
  if (isServer()) {
    cookie = ctx?.req?.headers?.cookie;
  }

  return {
    url: process.env.NEXT_PUBLIC_API_URL as string,
    fetchOptions: {
      credentials: "include" as const,
      headers: cookie ? { cookie } : undefined,
    },
    exchanges: [
      dedupExchange,
      cacheExchange({
        keys: {
          PaginatedPosts: () => null,
          PaginatedReplies: () => null,
        },
        resolvers: {
          Query: {
            posts: cursorPagination(),
          },
        },
        updates: {
          Mutation: {
            vote: (_result, args, cache, info) => {
              const { postId, value } = args as VoteMutationVariables;
              const data = cache.readFragment(
                gql`
                  fragment _ on Post {
                    id
                    points
                    voteStatus
                  }
                `,
                { id: postId }
              );
              if (data) {
                if (data.voteStatus === value) {
                  const newPoints = (data.points as number) - value;
                  data.voteStatus = null;
                  cache.writeFragment(
                    gql`
                      fragment __ on Post {
                        points
                        voteStatus
                      }
                    `,
                    { id: postId, points: newPoints, voteStatus: null }
                  );
                } else {
                  const newPoints =
                    (data.points as number) +
                    (!data.voteStatus ? 1 : 2) * value;
                  cache.writeFragment(
                    gql`
                      fragment __ on Post {
                        points
                        voteStatus
                      }
                    `,
                    { id: postId, points: newPoints, voteStatus: value }
                  );
                }
              }
            },
            voteReply: (_result, args, cache, info) => {
              const { replyId, value } = args as VoteReplyMutationVariables;
              const data = cache.readFragment(
                gql`
                  fragment _ on Reply {
                    id
                    points
                    voteStatus
                  }
                `,
                { id: replyId }
              );
              if (data) {
                if (data.voteStatus === value) {
                  const newPoints = (data.points as number) - value;
                  data.voteStatus = null;
                  cache.writeFragment(
                    gql`
                      fragment __ on Reply {
                        points
                        voteStatus
                      }
                    `,
                    { id: replyId, points: newPoints, voteStatus: null }
                  );
                } else {
                  const newPoints =
                    (data.points as number) +
                    (!data.voteStatus ? 1 : 2) * value;
                  cache.writeFragment(
                    gql`
                      fragment __ on Reply {
                        points
                        voteStatus
                      }
                    `,
                    { id: replyId, points: newPoints, voteStatus: value }
                  );
                }
              }
            },
            createPost: (_result, args, cache, info) => {
              invalidateAllPosts(cache);
            },
            createReply: (_result, args, cache, info) => {
              invalidateAllReplies(cache);
            },
            deletePost: (_result, args, cache, info) => {
              cache.invalidate({
                __typename: "Post",
                id: (args as DeletePostMutationVariables).id,
              });
            },
            deleteReply: (_result, args, cache, info) => {
              cache.invalidate({
                __typename: "Reply",
                id: (args as DeleteReplyMutationVariables).id,
              });
            },
            logout: (_result, args, cache, info) => {
              betterUpdateQuery<LogoutMutation, MeQuery>(
                cache,
                { query: MeDocument },
                _result,
                () => ({ me: null })
              );
            },

            login: (_result, args, cache, info) => {
              betterUpdateQuery<LoginMutation, MeQuery>(
                cache,
                { query: MeDocument },
                _result,
                (result, query) => {
                  if (result.login.errors) {
                    return query;
                  } else {
                    return {
                      me: result.login.user,
                    };
                  }
                }
              );
              invalidateAllPosts(cache);
              invalidateAllReplies(cache);
            },
            register: (_result, args, cache, info) => {
              betterUpdateQuery<RegisterMutation, MeQuery>(
                cache,
                { query: MeDocument },
                _result,
                (result, query) => {
                  if (result.register.errors) {
                    return query;
                  } else {
                    return {
                      me: result.register.user,
                    };
                  }
                }
              );
            },
          },
        },
      }),
      ssrExchange,
      fetchExchange,
    ],
  };
};
