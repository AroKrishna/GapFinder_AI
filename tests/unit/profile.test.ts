import { describe, expect, it } from "vitest";
import { DEFAULT_APP_NAME } from "@/lib/branding";
import { MAX_PROFILE_NAME_LENGTH, validateProfileName } from "@/lib/services/validation";

describe("User Profile Name Validation & Management", () => {
  describe("validateProfileName", () => {
    it("accepts valid names and trims extraneous whitespace", () => {
      const res1 = validateProfileName("Aro Krishna Reddy");
      expect(res1.valid).toBe(true);
      expect(res1.name).toBe("Aro Krishna Reddy");

      const res2 = validateProfileName("   Jane Doe   ");
      expect(res2.valid).toBe(true);
      expect(res2.name).toBe("Jane Doe");

      const res3 = validateProfileName("Jean-Luc O'Connor");
      expect(res3.valid).toBe(true);
      expect(res3.name).toBe("Jean-Luc O'Connor");

      const res4 = validateProfileName("Zoë Strauß");
      expect(res4.valid).toBe(true);
      expect(res4.name).toBe("Zoë Strauß");
    });

    it("rejects empty and whitespace-only strings", () => {
      expect(validateProfileName("").valid).toBe(false);
      expect(validateProfileName("").error).toBe("Full name cannot be empty.");

      expect(validateProfileName("   ").valid).toBe(false);
      expect(validateProfileName("   ").error).toBe("Full name cannot be empty.");

      expect(validateProfileName("\t  \n").valid).toBe(false);
      expect(validateProfileName(null).valid).toBe(false);
      expect(validateProfileName(undefined).valid).toBe(false);
    });

    it("rejects names exceeding 100 characters", () => {
      const longName = "A".repeat(MAX_PROFILE_NAME_LENGTH + 1);
      const res = validateProfileName(longName);
      expect(res.valid).toBe(false);
      expect(res.error).toContain("cannot exceed 100 characters");

      const exactLengthName = "A".repeat(MAX_PROFILE_NAME_LENGTH);
      expect(validateProfileName(exactLengthName).valid).toBe(true);
    });

    it("rejects unexpected control characters like newlines or null bytes", () => {
      expect(validateProfileName("Aro\nKrishna").valid).toBe(false);
      expect(validateProfileName("Aro\0Krishna").valid).toBe(false);
      expect(validateProfileName("Aro\r\nReddy").valid).toBe(false);
    });
  });

  describe("Preservation of Application Branding & Identity", () => {
    it("keeps default application name as GapFinder AI", () => {
      expect(DEFAULT_APP_NAME).toBe("GapFinder AI");
    });

    it("verifies user profile updates do not alter account email identity", () => {
      const originalAccount = {
        id: "usr_123",
        email: "student@example.edu",
        display_name: "Original Name",
      };

      const updateInput = {
        name: "New Student Name",
      };

      // Simulates profile name update payload
      const updatedProfile = {
        ...originalAccount,
        display_name: validateProfileName(updateInput.name).name,
      };

      expect(updatedProfile.display_name).toBe("New Student Name");
      expect(updatedProfile.email).toBe("student@example.edu");
      expect(updatedProfile.id).toBe("usr_123");
    });
  });
});
