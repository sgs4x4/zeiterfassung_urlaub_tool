"use server"

import { revalidatePath } from "next/cache"
import { createClient } from "@/lib/supabase/server"
import { requireAnyPermission, requirePermission } from "@/lib/permissions-server"

export interface Project {
  id: string
  name: string
  description: string | null
  color: string | null
  is_active: boolean
  created_at: string
  updated_at: string
}

export async function getProjects(): Promise<Project[]> {
  const supabase = await createClient()

  const { data, error } = await supabase.from("projects").select("*").eq("is_active", true).order("name")

  if (error) {
    console.error("Error fetching projects:", error)
    return []
  }

  return data || []
}

export async function getAllProjects(): Promise<Project[]> {
  const supabase = await createClient()
  await requireAnyPermission(["time.manage_projects", "users.assign_projects"])

  const { data, error } = await supabase.from("projects").select("*").order("name")

  if (error) {
    console.error("Error fetching all projects:", error)
    return []
  }

  return data || []
}

export async function createProject(formData: FormData) {
  const supabase = await createClient()
  await requirePermission("time.manage_projects")

  const name = formData.get("name") as string
  const description = formData.get("description") as string
  const color = formData.get("color") as string

  if (!name) {
    throw new Error("Projektname ist erforderlich")
  }

  const { error } = await supabase.from("projects").insert({
    name,
    description: description || null,
    color: color || "#6B7280",
    is_active: true,
  })

  if (error) {
    console.error("Error creating project:", error)
    throw new Error("Fehler beim Erstellen des Projekts")
  }

  revalidatePath("/admin")
  revalidatePath("/dashboard")
}

export async function updateProject(id: string, formData: FormData) {
  const supabase = await createClient()
  await requirePermission("time.manage_projects")

  const name = formData.get("name") as string
  const description = formData.get("description") as string
  const color = formData.get("color") as string
  const is_active = formData.get("is_active") === "true"

  const { error } = await supabase
    .from("projects")
    .update({
      name,
      description: description || null,
      color: color || "#6B7280",
      is_active,
    })
    .eq("id", id)

  if (error) {
    console.error("Error updating project:", error)
    throw new Error("Fehler beim Aktualisieren des Projekts")
  }

  revalidatePath("/admin")
  revalidatePath("/dashboard")
}

export async function deleteProject(id: string) {
  const supabase = await createClient()
  await requirePermission("time.manage_projects")

  // Soft delete - setze auf inaktiv
  const { error } = await supabase.from("projects").update({ is_active: false }).eq("id", id)

  if (error) {
    console.error("Error deleting project:", error)
    throw new Error("Fehler beim Löschen des Projekts")
  }

  revalidatePath("/admin")
  revalidatePath("/dashboard")
}

// Get projects assigned to a specific user
export async function getUserProjects(userId?: string): Promise<Project[]> {
  const supabase = await createClient()
  
  const session = await getServerSession()
  if (!session?.user?.email) {
    return []
  }

  // Get user's internal ID from email
  const { data: user } = await supabase
    .from("users")
    .select("id")
    .eq("email", session.user.email)
    .single()

  if (!user) {
    return []
  }

  // Check if user has any assigned projects
  const { data: userProjects } = await supabase
    .from("user_projects")
    .select("project_id")
    .eq("user_id", user.id)

  // If no projects assigned, return all active projects (fallback)
  if (!userProjects || userProjects.length === 0) {
    return getProjects()
  }

  // Return only assigned projects
  const projectIds = userProjects.map(up => up.project_id)
  const { data, error } = await supabase
    .from("projects")
    .select("*")
    .in("id", projectIds)
    .eq("is_active", true)
    .order("name")

  if (error) {
    console.error("Error fetching user projects:", error)
    return []
  }

  return data || []
}

// Assign projects to a user (Admin only)
export async function assignProjectsToUser(userId: string, projectIds: string[]) {
  const supabase = await createClient()
  await requirePermission("users.assign_projects")

  // Remove all existing assignments
  const { error: deleteError } = await supabase.from("user_projects").delete().eq("user_id", userId)

  // Add new assignments
  if (projectIds.length > 0) {
    const { error, data } = await supabase.from("user_projects").insert(
      projectIds.map(projectId => ({
        user_id: userId,
        project_id: projectId
      }))
    ).select()

    if (error) {
      console.error("Error assigning projects:", error)
      throw new Error("Fehler beim Zuweisen der Projekte")
    }
  }

  revalidatePath("/admin")
  revalidatePath("/dashboard")
  return { success: true }
}

// Get assigned project IDs for a user (Admin only)
export async function getUserProjectIds(userId: string): Promise<string[]> {
  const supabase = await createClient()
  await requirePermission("users.assign_projects")

  const { data, error } = await supabase
    .from("user_projects")
    .select("project_id")
    .eq("user_id", userId)

  if (error) {
    console.error("Error fetching user project ids:", error)
    return []
  }

  return data?.map(up => up.project_id) || []
}
