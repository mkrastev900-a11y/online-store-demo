export type DesignMode = "light" | "dark";
export type DesignDevice = "desktop" | "tablet" | "mobile";

export type ThemeTokenValue = string | number | boolean;

export type ThemeTokenMap = Record<string, ThemeTokenValue>;

export type ComponentStyleDefinition = {
  key: string;
  label: string;
  category: "layout" | "content" | "commerce" | "navigation" | "forms";
  tokenKeys: string[];
  supportsModes?: DesignMode[];
  supportsDevices?: DesignDevice[];
};

export type ResolvedDesignTheme = {
  version: 1;
  tokens: ThemeTokenMap;
  components: Record<string, ComponentStyleDefinition>;
};
