import { useContext, useState } from "react";
import Button from "../components/Button";
import Input from "../components/Input";
import Label from "../components/Label";
import { configStore } from "../config";
import { RouterContext } from "../router";

export default function AccountEditorView() {
  const router = useContext(RouterContext);
  const [name, setName] = useState(String());

  const onBack = () => {
    router.setView("accounts");
  };

  return (
    <div className="space-y-3">
      <div className="text-lg font-medium pl-3">
        Create a new Minecraft Account
      </div>
      <div className="flex flex-col space-y-1">
        <Label>Username</Label>
        <Input value={name} placeholder="Username" onChange={setName} />
      </div>
      <div className="flex space-x-1 pl-3">
        <Button onClick={onBack}>Cancel</Button>
        <Button
          onClick={() => {
            if (name) {
              onBack();
              configStore.accounts.push({
                username: name,
                category: "offline",
              });
            }
          }}
        >
          Save
        </Button>
      </div>
    </div>
  );
}
