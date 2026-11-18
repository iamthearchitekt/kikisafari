using UnityEditor;

namespace KikiSafari.EditorTools
{
    /// <summary>Imports Resources/UI art (logo, meadow, mascot, icon) as crisp UI textures: no mipmaps, up to 4K, high quality.</summary>
    public sealed class UiTextureImport : AssetPostprocessor
    {
        void OnPreprocessTexture()
        {
            if (!assetPath.Replace('\\', '/').Contains("/KikiSafari/Resources/UI/")) return;
            var ti = (TextureImporter)assetImporter;
            ti.textureType = TextureImporterType.Default;
            ti.sRGBTexture = true;
            ti.mipmapEnabled = false;
            ti.alphaIsTransparency = true;
            ti.npotScale = TextureImporterNPOTScale.None;
            ti.maxTextureSize = 4096;
            ti.textureCompression = TextureImporterCompression.CompressedHQ;
            ti.wrapMode = UnityEngine.TextureWrapMode.Clamp;
        }
    }
}
