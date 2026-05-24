// Mock 'server-only' (Next.js marker module not available in tests)
import { vi } from "vitest";
vi.mock("server-only", () => ({}));
