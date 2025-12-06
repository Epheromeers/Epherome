import { useContext, useState } from "react";
import Button from "../components/Button";
import Card from "../components/Card";
import Input from "../components/Input";
import { configStore } from "../config";
import { RouterContext } from "../router";

export default function InstancesView() {
  const [instances, setInstances] = useState(configStore.instances);
  const router = useContext(RouterContext);

  return (
    <div>
      <div className="flex items-center space-x-1">
        <Input placeholder="Search" />
        <Button onClick={() => router.setView("instanceEditor")}>Create</Button>
      </div>
      <div>
        {instances.map((value) => (
          <Card key={value.name} className="flex">
            <div>{value.name}</div>
            <Button
              onClick={() => {
                configStore.instances = configStore.instances.filter(
                  (instance) => instance.name !== value.name,
                );
                setInstances(configStore.instances);
              }}
            >
              Delete
            </Button>
          </Card>
        ))}
      </div>
    </div>
  );
}
