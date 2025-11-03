module.exports = {
  extends: ["stylelint-config-standard-scss"],
  plugins: ["stylelint-order"],
  rules: {
    "order/properties-order": [
      [
        "display",
        "position",
        "top",
        "right",
        "bottom",
        "left",
        "flex",
        "flex-direction",
        "justify-content",
        "align-items",
        "width",
        "height",
        "margin",
        "padding",
        "gap",
        "background",
        "border",
        "border-radius",
        "box-shadow",
        "color",
        "font-size",
        "line-height",
        "text-align",
        "cursor"
      ],
      { unspecified: "bottomAlphabetical" }
    ],
    "color-no-invalid-hex": true
  }
};
