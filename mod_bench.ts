import * as v from "npm:valibot";
import { z } from "npm:zod";
import complex from "./bench_complex.json" with { type: "json" };
import simple from "./bench_simple.json" with { type: "json" };
import * as s from "./mod.ts";

Deno.bench("zod - complex type", () => {
  const schema = z.object({
    data: z.object({
      rockets: z.array(z.object({
        active: z.boolean(),
        boosters: z.number().int(),
        company: z.string(),
        cost_per_launch: z.number().int(),
        country: z.string(),
        description: z.string(),
        diameter: z.object({
          feet: z.number(),
          meters: z.number(),
        }),
        engines: z.object({
          engine_loss_max: z.string().nullish(),
          layout: z.string().nullish(),
          number: z.number().int(),
          propellant_1: z.string(),
          propellant_2: z.string(),
          thrust_sea_level: z.object({
            kN: z.number().int(),
            lbf: z.number().int(),
          }),
          trust_vacuum: z.object({
            kN: z.number().int(),
            lbf: z.number().int(),
          }).nullish(),
          type: z.string(),
          version: z.string(),
        }),
        first_flight: z.string(),
        first_stage: z.object({
          burn_time_sec: z.number().int().nullish(),
          engines: z.number().int(),
          fuel_amount_tons: z.number(),
          reusable: z.boolean(),
          thrust_sea_level: z.object({
            kN: z.number().int(),
            lbf: z.number().int(),
          }),
          thrust_vacuum: z.object({
            kN: z.number().int(),
            lbf: z.number().int(),
          }),
        }),
        height: z.object({
          feet: z.number(),
          meters: z.number(),
        }),
        id: z.string(),
        landing_legs: z.object({
          material: z.string().nullish(),
          number: z.number().int(),
        }),
        mass: z.object({
          kg: z.number().int(),
          lb: z.number().int(),
        }),
        name: z.string(),
        payload_weights: z.array(z.object({
          id: z.string(),
          kg: z.number().int(),
          lb: z.number().int(),
          name: z.string(),
        })),
        second_stage: z.object({
          burn_time_sec: z.number().int().nullish(),
          engines: z.number().int(),
          fuel_amount_tons: z.number(),
          payloads: z.object({
            composite_fairing: z.object({
              diameter: z.object({
                feet: z.number().nullish(),
                meters: z.number().nullish(),
              }),
              height: z.object({
                feet: z.number().nullish(),
                meters: z.number().nullish(),
              }),
            }),
            option_1: z.string(),
          }),
          reusable: z.boolean().nullish(),
          thrust: z.object({
            kN: z.number().int(),
            lbf: z.number().int(),
          }),
        }),
        stages: z.number().int(),
        success_rate_pct: z.number().int(),
        type: z.string(),
        wikipedia: z.string(),
      })),
    }),
  });

  const result = schema.safeParse(complex);

  if (!result.success) {
    throw new Error(result.error.errors[0].message);
  }
});

Deno.bench("valibot - complex type", () => {
  const rocketSchema = v.object({
    active: v.boolean(),
    boosters: v.number([v.integer()]),
    company: v.string(),
    cost_per_launch: v.number([v.integer()]),
    country: v.string(),
    description: v.string(),
    diameter: v.object({
      feet: v.number(),
      meters: v.number(),
    }),
    engines: v.object({
      engine_loss_max: v.nullish(v.string()),
      layout: v.nullish(v.string()),
      number: v.number([v.integer()]),
      propellant_1: v.string(),
      propellant_2: v.string(),
      thrust_sea_level: v.object({
        kN: v.number([v.integer()]),
        lbf: v.number([v.integer()]),
      }),
      trust_vacuum: v.nullish(v.object({
        kN: v.number([v.integer()]),
        lbf: v.number([v.integer()]),
      })),
      type: v.string(),
      version: v.string(),
    }),
    first_flight: v.string(),
    first_stage: v.object({
      burn_time_sec: v.nullish(v.number([v.integer()])),
      engines: v.number([v.integer()]),
      fuel_amount_tons: v.number(),
      reusable: v.boolean(),
      thrust_sea_level: v.object({
        kN: v.number([v.integer()]),
        lbf: v.number([v.integer()]),
      }),
      thrust_vacuum: v.object({
        kN: v.number([v.integer()]),
        lbf: v.number([v.integer()]),
      }),
    }),
    height: v.object({
      feet: v.number(),
      meters: v.number(),
    }),
    id: v.string(),
    landing_legs: v.object({
      material: v.nullish(v.string()),
      number: v.number([v.integer()]),
    }),
    mass: v.object({
      kg: v.number([v.integer()]),
      lb: v.number([v.integer()]),
    }),
    name: v.string(),
    payload_weights: v.array(v.object({
      id: v.string(),
      kg: v.number([v.integer()]),
      lb: v.number([v.integer()]),
      name: v.string(),
    })),
    second_stage: v.object({
      burn_time_sec: v.nullish(v.number([v.integer()])),
      engines: v.number([v.integer()]),
      fuel_amount_tons: v.number(),
      payloads: v.object({
        composite_fairing: v.object({
          diameter: v.object({
            feet: v.nullish(v.number()),
            meters: v.nullish(v.number()),
          }),
          height: v.object({
            feet: v.nullish(v.number()),
            meters: v.nullish(v.number()),
          }),
        }),
        option_1: v.string(),
      }),
      reusable: v.nullish(v.boolean()),
      thrust: v.object({
        kN: v.number([v.integer()]),
        lbf: v.number([v.integer()]),
      }),
    }),
    stages: v.number([v.integer()]),
    success_rate_pct: v.number([v.integer()]),
    type: v.string(),
    wikipedia: v.string(),
  });

  const schema = v.object({
    data: v.object({
      rockets: v.array(rocketSchema),
    }),
  });

  const result = v.safeParse(schema, complex);

  if (!result.success) {
    throw new Error(result.issues[0].message);
  }
});

Deno.bench("@oxi/schema - complex type", () => {
  const schema = s.obj({
    data: s.obj({
      rockets: s.list(s.obj({
        active: s.bool(),
        boosters: s.pipe(s.num(), s.int()),
        company: s.str(),
        cost_per_launch: s.pipe(s.num(), s.int()),
        country: s.str(),
        description: s.str(),
        diameter: s.obj({
          feet: s.num(),
          meters: s.num(),
        }),
        engines: s.obj({
          engine_loss_max: s.opt(s.str()),
          layout: s.opt(s.str()),
          number: s.pipe(s.num(), s.int()),
          propellant_1: s.str(),
          propellant_2: s.str(),
          thrust_sea_level: s.obj({
            kN: s.pipe(s.num(), s.int()),
            lbf: s.pipe(s.num(), s.int()),
          }),
          trust_vacuum: s.opt(s.obj({
            kN: s.pipe(s.num(), s.int()),
            lbf: s.pipe(s.num(), s.int()),
          })),
          type: s.str(),
          version: s.str(),
        }),
        first_flight: s.str(),
        first_stage: s.obj({
          burn_time_sec: s.opt(s.pipe(s.num(), s.int())),
          engines: s.pipe(s.num(), s.int()),
          fuel_amount_tons: s.num(),
          reusable: s.bool(),
          thrust_sea_level: s.obj({
            kN: s.pipe(s.num(), s.int()),
            lbf: s.pipe(s.num(), s.int()),
          }),
          thrust_vacuum: s.obj({
            kN: s.pipe(s.num(), s.int()),
            lbf: s.pipe(s.num(), s.int()),
          }),
        }),
        height: s.obj({
          feet: s.num(),
          meters: s.num(),
        }),
        id: s.str(),
        landing_legs: s.opt(s.obj({
          material: s.opt(s.str()),
          number: s.pipe(s.num(), s.int()),
        })),
        mass: s.obj({
          kg: s.pipe(s.num(), s.int()),
          lb: s.pipe(s.num(), s.int()),
        }),
        name: s.str(),
        payload_weights: s.list(s.obj({
          id: s.str(),
          kg: s.pipe(s.num(), s.int()),
          lb: s.pipe(s.num(), s.int()),
          name: s.str(),
        })),
        second_stage: s.obj({
          burn_time_sec: s.opt(s.pipe(s.num(), s.int())),
          engines: s.pipe(s.num(), s.int()),
          fuel_amount_tons: s.num(),
          payloads: s.obj({
            composite_fairing: s.obj({
              diameter: s.obj({
                feet: s.opt(s.num()),
                meters: s.opt(s.num()),
              }),
              height: s.obj({
                feet: s.opt(s.num()),
                meters: s.opt(s.num()),
              }),
            }),
            option_1: s.str(),
          }),
          reusable: s.opt(s.bool()),
          thrust: s.obj({
            kN: s.pipe(s.num(), s.int()),
            lbf: s.pipe(s.num(), s.int()),
          }),
        }),
        stages: s.pipe(s.num(), s.int()),
        success_rate_pct: s.pipe(s.num(), s.int()),
        type: s.str(),
        wikipedia: s.str(),
      })),
    }),
  });

  const result = schema.parse(complex);

  if (result.isErr()) {
    throw new Error(result.unwrapErr().message);
  }
});

Deno.bench("zod - simple type", () => {
  const schema = z.array(z.object({
    id: z.number().int(),
    email: z.string().email(),
    password: z.string().min(8).max(64),
  }));

  const result = schema.safeParse(simple);

  if (!result.success) {
    throw new Error(result.error.errors[0].message);
  }
});

Deno.bench("valibot - simple type", () => {
  const schema = v.array(v.object({
    id: v.number([v.integer()]),
    email: v.string([v.email()]),
    password: v.string([v.minLength(8), v.maxLength(64)]),
  }));

  const result = v.safeParse(schema, simple);

  if (!result.success) {
    throw new Error(result.issues[0].message);
  }
});

Deno.bench("@oxi/schema - simple type", () => {
  const schema = s.list(s.obj({
    id: s.pipe(s.num(), s.int()),
    email: s.pipe(s.str(), s.email()),
    password: s.pipe(s.str(), s.minLen(8), s.maxLen(64)),
  }));

  const result = schema.parse(simple);

  if (result.isErr()) {
    throw new Error(result.unwrapErr().message);
  }
});
