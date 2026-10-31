import { Directory, Paths } from 'expo-file-system';

// expo-audio's stream writes every recording here. Web has no such folder.
const RECORDINGS_FOLDER = 'AudioStream';

/** Removes recordings from the phone. They stay only until a screening is finished or left. */
export function clearRecordingFiles() {
  try {
    const folder = new Directory(Paths.cache, RECORDINGS_FOLDER);
    if (folder.exists) folder.delete();
  } catch {
    // Nothing to clean up. A file left behind must never stop a screening.
  }
}
