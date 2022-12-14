import { withUrqlClient } from "next-urql";
import { PostsPage } from "../components/PostsPage";
import { createUrqlClient } from "../utils/createUrqlClient";

export const Index = () => {
  return <PostsPage searchFor="all" categoryHeading="Main" />;
};

export default withUrqlClient(createUrqlClient, { ssr: true })(Index);
