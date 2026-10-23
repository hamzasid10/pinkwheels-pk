import { describe, expect, it } from "vitest";
import { driverGate, effectiveMode, hasActiveTrip } from "@/lib/mode";
describe("mode switching", () => {
  it("only approved drivers get Driver Mode", () => {
    expect(effectiveMode("driver", driverGate("approved"))).toBe("driver");
    expect(effectiveMode("driver", driverGate("pending"))).toBe("passenger");
    expect(effectiveMode("driver", driverGate(null))).toBe("passenger");
    expect(effectiveMode("driver", driverGate("approved", true))).toBe("passenger");
  });
  it("active trips block leaving Driver Mode", () => {
    expect(hasActiveTrip(["ride_started"], [])).toBe(true);
    expect(hasActiveTrip([], ["started"])).toBe(true);
    expect(hasActiveTrip(["completed"], ["open"])).toBe(false);
  });
});
