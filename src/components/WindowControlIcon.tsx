export default function WindowControlIcon(props: {
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      className="flex items-center rounded-full p-2 hover:bg-gray-200/40"
      type="button"
      onClick={props.onClick}
    >
      {props.children}
    </button>
  );
}
