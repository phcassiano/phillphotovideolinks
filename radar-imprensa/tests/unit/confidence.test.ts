import { describe, expect, it } from "vitest";
import { aggregateConfidence, decideReview, isSensitiveChange, suggestedStatus, type ChangeOp } from "@/lib/confidence/policy";

const addJob: ChangeOp = { op: "add_employment", media_outlet_id: "o1", job_title: "Repórter" };
const topic: ChangeOp = { op: "add_topic", topic_name: "Clima" };

describe("política de confiança", () => {
  it("emprego e contato são sempre sensíveis", () => {
    expect(isSensitiveChange(addJob)).toBe(true);
    expect(isSensitiveChange({ op: "add_contact", contact_type: "email_profissional", contact_value: "a@b.example" })).toBe(true);
    expect(isSensitiveChange(topic)).toBe(false);
  });

  it("mudanças sensíveis exigem revisão humana mesmo com confiança máxima", () => {
    const d = decideReview([addJob], [
      { evidenceType: "perfil_institucional", confidence: 1, sourceDomain: "a.example" },
      { evidenceType: "expediente", confidence: 1, sourceDomain: "b.example" },
    ], { allowAutoApplyNonSensitive: true });
    expect(d.requiresHumanReview).toBe(true);
    expect(d.autoApplicable).toBe(false);
  });

  it("confirmação nunca é automática", () => {
    expect(decideReview([{ op: "confirm_current" }], [{ evidenceType: "perfil_institucional", confidence: 1, sourceDomain: "a" }], { allowAutoApplyNonSensitive: true }).autoApplicable).toBe(false);
  });

  it("evidências demonstrativas não contam", () => {
    expect(aggregateConfidence([{ evidenceType: "demonstrativa", confidence: 1, isDemo: true }])).toBe(0);
    expect(decideReview([topic], [{ evidenceType: "perfil_institucional", confidence: 1, isDemo: true }], { allowAutoApplyNonSensitive: true }).autoApplicable).toBe(false);
  });

  it("mudança não sensível só é automática quando a política permite e há fontes independentes", () => {
    const strong = [
      { evidenceType: "perfil_institucional" as const, confidence: 1, sourceDomain: "a.example" },
      { evidenceType: "expediente" as const, confidence: 1, sourceDomain: "b.example" },
    ];
    expect(decideReview([topic], strong).autoApplicable).toBe(false); // desativado por padrão
    expect(decideReview([topic], strong, { allowAutoApplyNonSensitive: true }).autoApplicable).toBe(true);
    expect(decideReview([topic], [strong[0]!, { ...strong[0]!, confidence: 0.99 }], { allowAutoApplyNonSensitive: true }).autoApplicable).toBe(false);
  });

  it("fontes do mesmo domínio não se somam e a confiança nunca chega a 1 com uma fonte", () => {
    const one = aggregateConfidence([{ evidenceType: "assinatura_materia", confidence: 0.8, sourceDomain: "x" }]);
    const sameDomain = aggregateConfidence([
      { evidenceType: "assinatura_materia", confidence: 0.8, sourceDomain: "x" },
      { evidenceType: "assinatura_materia", confidence: 0.8, sourceDomain: "x" },
    ]);
    expect(sameDomain).toBe(one);
    expect(one).toBeLessThan(1);
  });

  it("status sugerido nunca é confirmado", () => {
    expect(suggestedStatus([{ evidenceType: "declaracao_titular", confidence: 1, sourceDomain: "a" }])).toBe("provavel");
    expect(suggestedStatus([])).toBe("nao_verificado");
  });
});
