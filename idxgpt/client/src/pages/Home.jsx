export default function Home({ serverMsg }) {
  return (
    <div>
      <h1 className="text-2xl font-bold">AI Saham Client</h1>
      <p>Server says: {serverMsg}</p>
    </div>
  );
}
