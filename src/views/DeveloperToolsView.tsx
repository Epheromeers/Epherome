import { useContext, useState } from "react";
import Button from "../components/Button";
import Input from "../components/Input";
import Label from "../components/Label";
import RadioButton from "../components/RadioButton";
import { AppContext } from "../store";
import type { ToastCategory } from "../store/status";

export default function DeveloperToolsView() {
  const app = useContext(AppContext);
  const [toastCategory, setToastCategory] = useState<ToastCategory>("success");
  const [toastContent, setToastContent] = useState(String());

  return (
    <div className="flex h-full flex-col p-4">
      <div className="space-y-3">
        <h1 className="text-xl font-medium">Developer Tools</h1>
        <Label title="Toast Test" className="space-y-2">
          <div className="flex space-x-2">
            <RadioButton
              checked={toastCategory === "success"}
              onClick={() => setToastCategory("success")}
            >
              Success
            </RadioButton>
            <RadioButton
              checked={toastCategory === "fail"}
              onClick={() => setToastCategory("fail")}
            >
              Fail
            </RadioButton>
          </div>
          <div>
            <Input
              className="w-full max-w-sm"
              onChange={setToastContent}
              placeholder="Toast content"
              value={toastContent}
            />
          </div>
          <div>
            <Button
              onClick={() => {
                if (!toastContent.trim()) {
                  app.openDialog({
                    title: "Invalid Toast Content",
                    message: "Toast content cannot be empty.",
                  });
                  return;
                }

                app.openToast({
                  category: toastCategory,
                  content: toastContent,
                });
              }}
            >
              Open
            </Button>
          </div>
        </Label>
      </div>
      <div className="grow" />
      <div className="pt-3 text-xs text-gray-500 dark:text-gray-400">
        This page can be enabled or disabled in Settings.
      </div>
    </div>
  );
}
