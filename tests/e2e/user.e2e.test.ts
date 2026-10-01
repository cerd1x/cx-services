import { describe, expect, it } from "bun:test";
import { authHeaders, e2eLifecycle, gql, signUpUser } from "./_helper";

describe("user e2e (GraphQL over HTTP)", () => {
  e2eLifecycle();

  it("users returns the signed-up user", async () => {
    const { session, user } = await signUpUser();

    const { data, errors } = await gql<{ users: Array<{ id: string; name: string; username: string }> }>(
      `{ users { id name username } }`,
      undefined,
      authHeaders(session),
    );

    expect(errors).toBeUndefined();
    expect(data!.users.length).toBeGreaterThanOrEqual(1);
    expect(data!.users.some((u) => u.username === user.username)).toBe(true);
  });

  it("user(username) returns a single user", async () => {
    const { session, username } = await signUpUser();

    const { data, errors } = await gql<{ user: { name: string; username: string } }>(
      `query($username: String!) { user(username: $username) { name username } }`,
      { username },
      authHeaders(session),
    );

    expect(errors).toBeUndefined();
    expect(data!.user.username).toBe(username);
  });

  it("createUser creates a user (authorized)", async () => {
    const { session } = await signUpUser();
    const newUser = `created_${Date.now()}`;

    const { data, errors } = await gql<{ createUser: { id: string; name: string; username: string } }>(
      `mutation($input: CreateUserInput!) {
        createUser(input: $input) { id name username }
      }`,
      { input: { name: "Created User", username: newUser, password: "password123" } },
      authHeaders(session),
    );

    expect(errors).toBeUndefined();
    expect(data!.createUser.username).toBe(newUser);
    expect(data!.createUser.id).toBeTruthy();

    const list = await gql<{ users: Array<{ username: string }> }>(
      `{ users { username } }`,
      undefined,
      authHeaders(session),
    );
    expect(list.data!.users.some((u) => u.username === newUser)).toBe(true);
  });

  it("updateUserAvatar updates the avatar url", async () => {
    const { session, user } = await signUpUser();

    const avatarUrl = "https://example.com/avatar.png";
    const { data, errors } = await gql<{ updateUserAvatar: { id: string; avatarUrl: string | null } }>(
      `mutation($input: UpdateUserAvatarInput!) {
        updateUserAvatar(input: $input) { id avatarUrl }
      }`,
      { input: { userId: user.id, avatarUrl } },
      authHeaders(session),
    );

    expect(errors).toBeUndefined();
    expect(data!.updateUserAvatar.id).toBe(user.id);
    expect(data!.updateUserAvatar.avatarUrl).toBe(avatarUrl);
  });
});