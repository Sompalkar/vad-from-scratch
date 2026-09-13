import { describe, expect, it } from "vitest";
import { predict, sigmoid, train } from "./logistic.js";

describe("logistic regression", () => {
  it("sigmoid maps 0 to 0.5 and saturates", () => {
    expect(sigmoid(0)).toBe(0.5);
    expect(sigmoid(20)).toBeCloseTo(1);
    expect(sigmoid(-20)).toBeCloseTo(0);
  });

  it("learns a linearly separable 2D problem", () => {
    // Positive class: x + y > 1
    const X: number[][] = [];
    const y: number[] = [];
    for (let i = 0; i < 200; i++) {
      const a = (i % 20) / 10;
      const b = Math.floor(i / 20) / 5;
      X.push([a, b]);
      y.push(a + b > 1 ? 1 : 0);
    }
    const { model, loss } = train(X, y);

    expect(loss.at(-1)).toBeLessThan(loss[0] ?? Infinity);
    expect(predict(model, [1.5, 1.5])).toBeGreaterThan(0.9);
    expect(predict(model, [0.1, 0.1])).toBeLessThan(0.1);
  });
});
