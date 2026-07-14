import React from "react";

export function PageContainer({ as: Component = "div", className = "", children }) {
  return <Component className={`mx-auto w-full max-w-7xl px-4 sm:px-5 lg:px-6 ${className}`}>{children}</Component>;
}
