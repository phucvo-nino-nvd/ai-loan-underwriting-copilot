import { useSignIn } from "@clerk/nextjs";
export function Test() {
  const obj = useSignIn();
  return <div />;
}
