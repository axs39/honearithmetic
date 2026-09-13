/** Serialize profile cloud writes so overlapping endGame/SaveBootstrap
 *  pushes cannot read the same prior and clobber each other's sessions. */

let chain: Promise<void> = Promise.resolve();

export function enqueueCloudSave<T>(task: () => Promise<T>): Promise<T> {
  const run = chain.then(task, task);
  chain = run.then(
    () => undefined,
    () => undefined,
  );
  return run;
}
