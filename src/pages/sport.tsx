import { withUrqlClient } from "next-urql";
import { PostsPage } from "../components/PostsPage";
import { createUrqlClient } from "../utils/createUrqlClient";

export const Sport = () => {
  return <PostsPage searchFor="sport" categoryHeading="Sport" />;
};

export default withUrqlClient(createUrqlClient, { ssr: true })(Sport);
