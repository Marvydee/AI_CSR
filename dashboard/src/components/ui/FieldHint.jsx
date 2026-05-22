import React from "react";

const FieldHint = ({ children }) => {
  if (!children) return null;
  return <p className="field-hint">{children}</p>;
};

export default FieldHint;
