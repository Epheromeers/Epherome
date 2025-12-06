export default function Label(props: { children: React.ReactNode }) {
  return (
    <span className="text-sm font-medium text-gray-700 pl-3">
      {props.children}
    </span>
  );
}
