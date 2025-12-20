import { openUrl } from "@tauri-apps/plugin-opener";

export default function Link(props: {
  target: string;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      className="text-blue-500 hover:underline"
      onClick={() => {
        openUrl(props.target);
      }}
    >
      {props.children}
    </button>
  );
}
