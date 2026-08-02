async function a() { return [1, 2]; }
async function b() {
  const arr = await a().map(x => x*2);
  console.log(arr);
}
b().catch(e => console.error(e.message));
