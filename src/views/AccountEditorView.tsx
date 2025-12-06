import { useContext, useState } from "react";
import Button from "../components/Button";
import Input from "../components/Input";
import { configStore } from "../config";
import { RouterContext } from "../router";

export default function AccountEditorView() {
  const router = useContext(RouterContext);
  const [name, setName] = useState(String());

  const onBack = () => {
    router.setView("accounts");
  };

  return (
    <div>
      <div>
        <Button onClick={onBack}>Back</Button>
      </div>
      <div>
        <Input value={name} placeholder="Account Name" onChange={setName} />
      </div>
      <div className="flex">
        <Button onClick={onBack}>Cancel</Button>
        <Button
          onClick={() => {
            if (name) {
              onBack();
              configStore.accounts.push(name);
            }
          }}
        >
          Save
        </Button>
      </div>
    </div>
  );
}
