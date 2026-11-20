import * as React from "react";
import {
  FileInput as PrimitiveFileInput,
  FileInputDropzone as PrimitiveFileInputDropzone,
  FileInputItem as PrimitiveFileInputItem,
  FileInputItemRemove as PrimitiveFileInputItemRemove,
  FileInputList as PrimitiveFileInputList,
  FileInputTrigger as PrimitiveFileInputTrigger,
  createFileInputController,
} from "@ui-sdk/react/file-input";
import { cn } from "../../lib/utils";

const FileInput = PrimitiveFileInput;
const FileInputTrigger = PrimitiveFileInputTrigger;
const FileInputList = PrimitiveFileInputList;
const FileInputItem = PrimitiveFileInputItem;
const FileInputItemRemove = PrimitiveFileInputItemRemove;

const FileInputDropzone = React.forwardRef<
  HTMLDivElement,
  React.ComponentPropsWithoutRef<typeof PrimitiveFileInputDropzone>
>(({ className, ...props }, ref) => (
  <PrimitiveFileInputDropzone
    ref={ref}
    className={cn(
      "flex flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-border-strong bg-background/60 p-5 text-center transition-colors hover:border-primary/60 hover:bg-accent/40 data-[dragging]:border-primary data-[dragging]:bg-primary/10 data-[drag-reject]:border-destructive data-[drag-reject]:bg-destructive/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring cursor-pointer",
      className
    )}
    {...props}
  />
));
FileInputDropzone.displayName = "FileInputDropzone";

export {
  FileInput,
  FileInputDropzone,
  FileInputItem,
  FileInputItemRemove,
  FileInputList,
  FileInputTrigger,
  createFileInputController,
};
