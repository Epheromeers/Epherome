import { errorList } from "../store";

export default function ErrorView() {
  return (
    <div className="p-4">
      <div>Errors occurred will be shown here.</div>
      {errorList.map((error, index) => (
        <div key={index.toString()}>{error}</div>
      ))}
    </div>
  );
}
