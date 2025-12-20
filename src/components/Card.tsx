export default function Card(props: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`border border-gray-300 dark:border-gray-700 rounded-lg p-3 ${props.className}`}
    >
      {props.children}
    </div>
  );
}
