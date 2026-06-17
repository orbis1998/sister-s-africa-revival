import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/login/$role")({
  beforeLoad: () => {
    throw redirect({ to: "/login" });
  },
});
