declare module "react-diff-viewer-continued" {
  import { ComponentType } from "react";

  export interface DiffViewerProps {
    oldValue: string;
    newValue: string;
    splitView?: boolean;
    useDarkTheme?: boolean;
    leftTitle?: string;
    rightTitle?: string;
    [key: string]: any;
  }

  const DiffViewer: ComponentType<DiffViewerProps>;
  export default DiffViewer;
}

declare module "ignore";
declare module "diff";
