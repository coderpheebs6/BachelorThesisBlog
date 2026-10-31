const SUPABASE_URL = "https://xddphuxfcucmjokcpkex.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_Zi16ftqqnKWSyC0RJ9kKzQ_uZln61Ou";

const supabaseConfigured =
  !SUPABASE_URL.includes("YOUR-PROJECT") &&
  !SUPABASE_ANON_KEY.includes("YOUR-SUPABASE");

const supabaseClient = supabaseConfigured
  ? window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY)
  : null;

function normalizeCategories(value) {
  if (Array.isArray(value)) return value;
  return value ? [value] : [];
}

function normalizeAttachments(post) {
  if (Array.isArray(post.attachments)) return post.attachments;
  return post.attachment_url ? [{ type: post.attachment_type || "link", url: post.attachment_url }] : [];
}

window.fieldnotesData = {
  configured: supabaseConfigured,
  async getPosts(includeDeleted = false) {
    if (!supabaseClient) return [];

    let postsQuery = supabaseClient
      .from("posts")
      .select("id, category, title, body, conclusion, ai_usage, attachment_type, attachment_url, attachments, author_id, date, deleted_at");
    if (!includeDeleted) postsQuery = postsQuery.is("deleted_at", null);
    const { data, error } = await postsQuery.order("date", { ascending: false });

    if (error) throw error;

    const authorIds = [...new Set((data || []).map(post => post.author_id).filter(Boolean))];
    if (!authorIds.length) {
      return (data || []).map(post => ({ ...post, attachments: normalizeAttachments(post) }));
    }

    const { data: profiles, error: profileError } = await supabaseClient
      .from("profiles")
      .select("id, display_name, avatar_url")
      .in("id", authorIds);

    if (profileError) throw profileError;
    const profileById = new Map((profiles || []).map(profile => [profile.id, profile]));

    return (data || []).map(post => {
      const profile = profileById.get(post.author_id);
      return {
        ...post,
        category: normalizeCategories(post.category),
        author_name: profile?.display_name || post.author_name,
        author_avatar: profile?.avatar_url || post.author_avatar,
        attachments: normalizeAttachments(post)
      };
    });
  },
  async addPost(post) {
    if (!supabaseClient) throw new Error("Supabase is not configured.");

    const session = await this.getSession();
    if (!session?.user?.id) throw new Error("You must be logged in.");

    const { data, error } = await supabaseClient
      .from("posts")
      .insert({ ...post, author_id: session.user.id })
      .select()
      .single();

    if (error) throw error;
    return { ...data, category: normalizeCategories(data?.category) };
  },
  async updatePost(id, post) {
    if (!supabaseClient) throw new Error("Supabase is not configured.");

    const session = await this.getSession();
    if (!session?.user?.id) throw new Error("You must be logged in.");

    const { data, error } = await supabaseClient
      .from("posts")
      .update(post)
      .eq("id", id)
      .select()
      .maybeSingle();

    if (error) throw error;
    if (!data) {
      throw new Error("The note could not be updated. Check that the posts update policy allows your account to edit its own notes.");
    }
    return data;
  },
  async getProfile() {
    if (!supabaseClient) return null;
    const session = await this.getSession();
    if (!session?.user?.id) return null;

    const { data, error } = await supabaseClient
      .from("profiles")
      .select("display_name, avatar_url")
      .eq("id", session.user.id)
      .maybeSingle();

    if (error) throw error;
    return data;
  },
  async saveProfile(profile) {
    if (!supabaseClient) throw new Error("Supabase is not configured.");
    const session = await this.getSession();
    if (!session?.user?.id) throw new Error("You must be logged in.");

    const { data, error } = await supabaseClient
      .from("profiles")
      .upsert({ id: session.user.id, ...profile })
      .select()
      .single();

    if (error) throw error;
    return data;
  },
  async uploadAvatar(file) {
    if (!supabaseClient) throw new Error("Supabase is not configured.");
    if (!file || !file.type.startsWith("image/")) {
      throw new Error("Please choose an image.");
    }
    if (file.size > 5 * 1024 * 1024) {
      throw new Error("The image must be smaller than 5 MB.");
    }

    const { data: userData, error: userError } = await supabaseClient.auth.getUser();
    if (userError) throw new Error(`authentication check failed: ${userError.message}`);
    if (!userData.user?.id) {
      throw new Error("No active Supabase login. Log out and log in again.");
    }

    const extension = file.name.split(".").pop()?.toLowerCase() || "jpg";
    const path = `${userData.user.id}/avatar-${Date.now()}.${extension}`;
    const { error: uploadError } = await supabaseClient.storage
      .from("avatars")
      .upload(path, file, { cacheControl: "3600", upsert: true });

    if (uploadError) throw uploadError;
    return supabaseClient.storage.from("avatars").getPublicUrl(path).data.publicUrl;
  },
  async uploadPostMedia(files) {
    if (!supabaseClient) throw new Error("Supabase is not configured.");
    const session = await this.getSession();
    if (!session?.user?.id) throw new Error("You must be logged in.");
    const selectedFiles = [...files];
    if (selectedFiles.some(file => !file.type.startsWith("image/") && !file.type.startsWith("video/"))) {
      throw new Error("Only image and video files can be uploaded.");
    }
    if (selectedFiles.some(file => file.size > 50 * 1024 * 1024)) {
      throw new Error("Each photo or video must be smaller than 50 MB.");
    }
    return Promise.all(selectedFiles.map(async file => {
      const extension = file.name.split(".").pop()?.toLowerCase() || "bin";
      const path = `${session.user.id}/post-${Date.now()}-${crypto.randomUUID()}.${extension}`;
      const { error } = await supabaseClient.storage.from("post-media").upload(path, file, {
        cacheControl: "3600",
        upsert: false
      });
      if (error) throw error;
      return {
        type: file.type.startsWith("video/") ? "video" : "image",
        url: supabaseClient.storage.from("post-media").getPublicUrl(path).data.publicUrl,
        name: file.name
      };
    }));
  },
  async deletePost(id) {
    if (!supabaseClient) throw new Error("Supabase is not configured.");
    const { error } = await supabaseClient.from("posts").update({ deleted_at: new Date().toISOString() }).eq("id", id);
    if (error) throw error;
  },
  async restorePost(id) {
    if (!supabaseClient) throw new Error("Supabase is not configured.");
    const { error } = await supabaseClient.from("posts").update({ deleted_at: null }).eq("id", id);
    if (error) throw error;
  },
  async permanentlyDeletePost(id) {
    if (!supabaseClient) throw new Error("Supabase is not configured.");
    const { error } = await supabaseClient.from("posts").delete().eq("id", id);
    if (error) throw error;
  },
  async getChatMessages() {
    if (!supabaseClient) return [];

    const { data, error } = await supabaseClient
      .from("team_messages")
      .select("id, message, author_id, created_at")
      .order("created_at", { ascending: true });

    if (error) throw error;

    const authorIds = [...new Set((data || []).map(item => item.author_id).filter(Boolean))];
    if (!authorIds.length) return data || [];

    const { data: profiles, error: profileError } = await supabaseClient
      .from("profiles")
      .select("id, display_name, avatar_url")
      .in("id", authorIds);

    if (profileError) throw profileError;
    const profileById = new Map((profiles || []).map(profile => [profile.id, profile]));
    return (data || []).map(item => ({
      ...item,
      author_name: profileById.get(item.author_id)?.display_name || "PKL Studio team",
      author_avatar: profileById.get(item.author_id)?.avatar_url || null
    }));
  },
  async addChatMessage(message) {
    if (!supabaseClient) throw new Error("Supabase is not configured.");

    const session = await this.getSession();
    if (!session?.user?.id) throw new Error("You must be logged in.");

    const { error } = await supabaseClient
      .from("team_messages")
      .insert({ message, author_id: session.user.id });

    if (error) throw error;
  },
  subscribeToChatMessages(callback) {
    if (!supabaseClient) return () => {};

    const channel = supabaseClient
      .channel("team-messages-live")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "team_messages" },
        callback
      )
      .subscribe();

    return () => {
      supabaseClient.removeChannel(channel);
    };
  },
  async updateChatMessage(id, message) {
    if (!supabaseClient) throw new Error("Supabase is not configured.");
    const session = await this.getSession();
    if (!session?.user?.id) throw new Error("You must be logged in.");

    const { error } = await supabaseClient
      .from("team_messages")
      .update({ message })
      .eq("id", id)
      .eq("author_id", session.user.id);

    if (error) throw error;
  },
  async deleteChatMessage(id) {
    if (!supabaseClient) throw new Error("Supabase is not configured.");
    const session = await this.getSession();
    if (!session?.user?.id) throw new Error("You must be logged in.");

    const { error } = await supabaseClient
      .from("team_messages")
      .delete()
      .eq("id", id)
      .eq("author_id", session.user.id);

    if (error) throw error;
  },
  async getDraft() {
    const drafts = await this.getDrafts();
    return drafts[0] || null;
  },
  async getDrafts(includeDeleted = false) {
    if (!supabaseClient) return [];
    const session = await this.getSession();
    if (!session?.user?.id) return [];

    let draftsQuery = supabaseClient
      .from("team_drafts")
      .select("id, category, title, body, conclusion, ai_usage, attachment_type, attachment_url, attachments, author_id, updated_at, deleted_at")
      .eq("author_id", session.user.id);
    if (!includeDeleted) draftsQuery = draftsQuery.is("deleted_at", null);
    const { data, error } = await draftsQuery.order("updated_at", { ascending: false });

    if (error) throw error;
    return (data || []).map(draft => ({
      ...draft,
      category: normalizeCategories(draft.category),
      attachments: normalizeAttachments(draft)
    }));
  },
  async saveDraft(draft) {
    if (!supabaseClient) throw new Error("Supabase is not configured.");
    const session = await this.getSession();
    if (!session?.user?.id) throw new Error("You must be logged in.");

    const draftId = draft.id;
    const draftValues = {
      category: Array.isArray(draft.category) ? draft.category : [draft.category],
      title: draft.title,
      body: draft.body,
      conclusion: draft.conclusion,
      ai_usage: draft.ai_usage,
      attachment_type: draft.attachment_type,
      attachment_url: draft.attachment_url,
      attachments: Array.isArray(draft.attachments) ? draft.attachments : [],
      author_id: session.user.id,
      updated_at: new Date().toISOString()
    };
    let query = supabaseClient.from("team_drafts");
    const { error } = draftId
      ? await query.update(draftValues).eq("id", draftId).eq("author_id", session.user.id)
      : await query.insert(draftValues);

    if (error) throw error;
  },
  async deleteDraft(id) {
    if (!supabaseClient) throw new Error("Supabase is not configured.");
    const session = await this.getSession();
    if (!session?.user?.id) throw new Error("You must be logged in.");

    const { error } = await supabaseClient
      .from("team_drafts")
      .update({ deleted_at: new Date().toISOString() })
      .eq("id", id)
      .eq("author_id", session.user.id);
    if (error) throw error;
  },
  async restoreDraft(id) {
    if (!supabaseClient) throw new Error("Supabase is not configured.");
    const { error } = await supabaseClient.from("team_drafts").update({ deleted_at: null }).eq("id", id);
    if (error) throw error;
  },
  async permanentlyDeleteDraft(id) {
    if (!supabaseClient) throw new Error("Supabase is not configured.");
    const { error } = await supabaseClient.from("team_drafts").delete().eq("id", id);
    if (error) throw error;
  },
  async signIn(email, password) {
    if (!supabaseClient) throw new Error("Supabase is not configured.");
    return supabaseClient.auth.signInWithPassword({ email, password });
  },
  async signOut() {
    if (supabaseClient) await supabaseClient.auth.signOut();
  },
  onAuthStateChange(callback) {
    if (!supabaseClient) return () => {};
    const { data } = supabaseClient.auth.onAuthStateChange(callback);
    return () => data.subscription.unsubscribe();
  },
  async getSession() {
    if (!supabaseClient) return null;
    const { data } = await supabaseClient.auth.getSession();
    return data.session;
  }
};
