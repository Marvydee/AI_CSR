import React from "react";

const PageGuide = ({ title, description, steps = [] }) => {
  return (
    <section className="ux-guide" aria-label={title || "Feature guide"}>
      {title ? <h3 className="ux-guide-title">{title}</h3> : null}
      {description ? (
        <p className="ux-guide-description">{description}</p>
      ) : null}
      {steps.length > 0 ? (
        <ol className="ux-guide-steps">
          {steps.map((step, index) => (
            <li key={`${step}-${index}`}>{step}</li>
          ))}
        </ol>
      ) : null}
    </section>
  );
};

export default PageGuide;
