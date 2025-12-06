export default function Button(props: {
  children: React.ReactNode;
  onClick?: () => void;
}) {
  return (
    <button
      className="bg-blue-400 rounded-full text-sm font-medium text-white px-3 py-1 hover:bg-blue-500 active:bg-blue-600"
      type="button"
      onClick={props.onClick}
    >
      {props.children}
    </button>
  );
}
