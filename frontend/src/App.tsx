import ListGroup from "./components/listGroup";

let items = ["new york", "los angeles", "chicago", "tokyo", "london"];
function App() {
  return (
    <div className="App">
      <ListGroup items={items} heading="cities"/>
    </div>
  );
}
export default App;